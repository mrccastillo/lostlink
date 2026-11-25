import type { Db, Filter } from "mongodb";
import type { Report } from "@/lib/reports/service";
import type { ListingRow } from "./listings";
import { MATCH_WINDOW_DAYS, rankMatches, type MatchFields } from "./matching";

type Actor = { id: string; emailVerified: boolean };
type MatchRow = MatchFields & Pick<Report, "_id"> & { candidates: ListingRow[] };
const REPORTS_PER_PAGE = 5;
const CANDIDATES_PER_REPORT = 250;
const indexSetup = new WeakMap<Db, Promise<string>>();

function ensureMatchIndexV1(db: Db) {
  let ready = indexSetup.get(db);
  if (!ready) {
    ready = db.collection("reports").createIndex(
      { organization: 1, type: 1, moderation: 1, lifecycle: 1, occurredOn: 1, _id: 1 },
      { name: "reports_match_candidates_v1" },
    ).catch((error: unknown) => {
      indexSetup.delete(db);
      throw error;
    });
    indexSetup.set(db, ready);
  }
  return ready;
}

export async function listMatches(db: Db, actor: Actor | null, requestedPage: number) {
  if (!actor?.emailVerified) throw new Error("Verified membership required");
  const reports = db.collection<Report>("reports");
  const ownLost: Filter<Report> = {
    organization: "community",
    ownerId: actor.id,
    type: "lost",
    moderation: { $in: ["pending", "published"] },
    lifecycle: "open",
  };
  const count = await reports.countDocuments(ownLost);
  const pages = Math.max(1, Math.ceil(count / REPORTS_PER_PAGE));
  const page = Number.isSafeInteger(requestedPage) ? Math.max(1, Math.min(requestedPage, pages)) : 1;
  if (!count) return { groups: [], page, pages };

  await ensureMatchIndexV1(db);
  const rows = await reports.aggregate<MatchRow>([
    { $match: ownLost },
    { $sort: { createdAt: -1, _id: -1 } },
    { $skip: (page - 1) * REPORTS_PER_PAGE },
    { $limit: REPORTS_PER_PAGE },
    { $project: { title: 1, description: 1, category: 1, location: 1, occurredOn: 1 } },
    {
      $lookup: {
        from: "reports",
        as: "candidates",
        let: {
          lostOn: "$occurredOn",
          latestFoundOn: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: {
                $dateAdd: {
                  startDate: { $dateFromString: { dateString: "$occurredOn", format: "%Y-%m-%d", onError: null } },
                  unit: "day",
                  amount: MATCH_WINDOW_DAYS,
                },
              },
            },
          },
        },
        pipeline: [
          {
            $match: {
              organization: "community",
              ownerId: { $ne: actor.id },
              type: "found",
              moderation: "published",
              lifecycle: "open",
              $expr: { $and: [{ $gte: ["$occurredOn", "$$lostOn"] }, { $lte: ["$occurredOn", "$$latestFoundOn"] }] },
            },
          },
          { $sort: { occurredOn: 1, _id: 1 } },
          { $limit: CANDIDATES_PER_REPORT },
          { $project: {
            type: 1, title: 1, description: 1, category: 1, location: 1, occurredOn: 1,
            lifecycle: 1, approvedMedia: 1, canClaim: { $literal: true },
          } },
        ],
      },
    },
  ]).toArray();
  return {
    groups: rows.map(({ candidates, ...lost }) => ({
      id: lost._id,
      title: lost.title,
      occurredOn: lost.occurredOn,
      matches: rankMatches(lost, candidates),
    })),
    page,
    pages,
  };
}
