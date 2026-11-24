import "server-only";
import type { Db, Filter } from "mongodb";
import { getDomainDatabase } from "@/lib/mongodb";
import { getCurrentSession } from "@/lib/auth/session";
import type { Report } from "@/lib/reports/service";
import { REPORT_CATEGORIES } from "@/features/reports/policy";

export type Query = Record<string, string | string[] | undefined>;
type PublishedReport = Report & { approvedMedia?: string[] };
type Media = { _id: string; reportId: string; resourceType: "image" | "video" };
export type Listing = Pick<Report, "type" | "title" | "location" | "category" | "description" | "occurredOn" | "lifecycle"> & {
  id: string; canClaim: boolean; media: { url: string; kind: Media["resourceType"] }[];
};
export type ListingRow = Omit<Listing, "media" | "id"> & Pick<PublishedReport, "_id" | "approvedMedia">;

const PAGE_SIZE = 18;
const titleCollation = { locale: "en", strength: 3 };
const indexSetup = new WeakMap<Db, Promise<string>>();

async function ensureBrowseIndexV1(db: Db) {
  let ready = indexSetup.get(db);
  if (!ready) {
    ready = db.collection("reports").createIndex(
      { organization: 1, moderation: 1, title: 1, _id: 1 },
      { name: "reports_publication_browse_v1", collation: titleCollation },
    ).catch((error: unknown) => {
      indexSetup.delete(db);
      throw error;
    });
    indexSetup.set(db, ready);
  }
  await ready;
}

function input(value: Query[string]) {
  return typeof value === "string" ? value.trim().slice(0, 120) : "";
}

export async function attachListingMedia(db: Db, rows: ListingRow[]): Promise<Listing[]> {
  const ids = rows.flatMap(row => row.approvedMedia ?? []);
  const files = ids.length ? await db.collection<Media>("report_media").find({
    _id: { $in: ids }, reportId: { $in: rows.map(row => row._id) }, resourceType: { $in: ["image", "video"] },
  }, { projection: { reportId: 1, resourceType: 1 } }).toArray() : [];
  const filesById = new Map(files.map(file => [file._id, file]));
  return rows.map(({ _id, approvedMedia, ...fields }) => ({
    ...fields, id: _id, media: (approvedMedia ?? []).flatMap(id => {
      const file = filesById.get(id);
      return file?.reportId === _id ? [{ kind: file.resourceType, url: `/api/case-media/published/${_id}/${id}` }] : [];
    }),
  }));
}

export async function listPublished(params: Query) {
  const session = await getCurrentSession();
  if (!session?.user.emailVerified) throw new Error("Verified membership required");
  const { db } = await getDomainDatabase();
  await ensureBrowseIndexV1(db);
  const reports = db.collection<PublishedReport>("reports");
  const scope = { organization: "community", moderation: "published", lifecycle: { $ne: "archived" } } as const;
  const q = input(params.q);
  const type = params.type === "found" || params.type === "lost" ? params.type : "all";
  const category = REPORT_CATEGORIES.find(value => value === params.category) ?? "";
  const location = input(params.location);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(input(params.date)) ? input(params.date) : "";
  const sort = params.sort === "za" ? "za" : "az";
  const filters = { q, type, category, location, date, sort };
  const literal = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const filter: Filter<PublishedReport> = {
    ...scope, ...(category && { category }), ...(location && { location }), ...(date && { occurredOn: date }),
    ...(q && { $or: [{ title: literal }, { category: literal }, { location: literal }, { description: literal }] }),
  };
  const [found, lost, suggestions] = await Promise.all([
    reports.countDocuments({ ...filter, type: "found" }), reports.countDocuments({ ...filter, type: "lost" }),
    reports.aggregate<{ _id: string }>([{ $match: scope }, { $group: { _id: "$location" } }, { $sort: { _id: 1 } }, { $limit: 100 }]).toArray(),
  ]);
  const counts = { all: found + lost, found, lost };
  const pages = Math.max(1, Math.ceil(counts[type] / PAGE_SIZE));
  const requested = Number(input(params.page));
  const page = Number.isSafeInteger(requested) ? Math.min(pages, Math.max(1, requested)) : 1;
  const direction = sort === "az" ? 1 : -1;
  const rows = await reports.find({ ...filter, ...(type !== "all" && { type }) }).project<ListingRow>({
    title: 1, type: 1, category: 1, location: 1, description: 1, occurredOn: 1, lifecycle: 1, approvedMedia: 1,
    canClaim: { $and: [{ $eq: ["$type", "found"] }, { $eq: ["$lifecycle", "open"] }, { $ne: ["$ownerId", { $literal: session.user.id }] }] },
  }).collation(titleCollation).sort({ title: direction, _id: direction }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).toArray();
  const items = await attachListingMedia(db, rows);
  return { items, filters, page, pages, counts, type, locations: suggestions.map(row => row._id) } as const;
}
