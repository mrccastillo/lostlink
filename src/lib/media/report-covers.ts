import type { Db } from "mongodb";

export async function reportCovers(db: Db, reports: { _id: string; attachments?: string[] }[], kind: "report" | "own") {
  const ids = reports.flatMap(report => report.attachments ?? []);
  const images = ids.length ? await db.collection<{ _id: string; reportId: string }>("report_media").find({
    _id: { $in: ids }, resourceType: "image",
  }, { projection: { reportId: 1 }, limit: ids.length }).toArray() : [];
  const parents = new Map(images.map(image => [image._id, image.reportId]));
  const covers = new Map<string, string>();
  for (const report of reports) {
    const image = report.attachments?.find(id => parents.get(id) === report._id);
    if (image) covers.set(report._id, `/api/case-media/${kind}/${report._id}/${image}`);
  }
  return covers;
}
