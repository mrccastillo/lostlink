"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Dialog } from "@/components/dialog";
import { loadPostAttachments, type AttachmentAccess } from "@/features/media/actions";
import { POST_ITEM_LOGIN_PATH, POST_MODAL_PATH } from "@/lib/auth/policy";
import { ReportForm } from "@/features/reports/report-form";
import "./post-modal.css";

function PostContent({ onSubmitted }: { onSubmitted: () => void }) {
  const [access, setAccess] = useState<AttachmentAccess | null>(null);
  async function reload() {
    try {
      setAccess(await loadPostAttachments());
    } catch {
      setAccess({ status: "unavailable", message: "We couldn’t reach attachment services. Please try again." });
    }
  }
  useEffect(() => {
    let active = true;
    loadPostAttachments().then(
      (result) => { if (active) setAccess(result); },
      () => { if (active) setAccess({ status: "unavailable", message: "We couldn’t reach account services. Please try again." }); },
    );
    return () => { active = false; };
  }, []);

  if (!access) return <p role="status" className="post-modal-copy">Checking your account…</p>;
  if (access.status === "guest") return (
    <div className="post-modal-body"><p className="post-modal-copy">Sign in with a verified account to prepare your attachments.</p><Link href={POST_ITEM_LOGIN_PATH} className="button button-yellow">Sign in to continue</Link></div>
  );
  if (access.status === "unverified") return (
    <div className="post-modal-body"><p className="post-modal-copy">Verify your email before uploading attachments.</p><Link href={`/verify-email?next=${encodeURIComponent(POST_MODAL_PATH)}`} className="button button-yellow">Verify email</Link></div>
  );
  if (access.status === "unavailable") return (
    <div className="post-modal-body"><p role="status" className="post-modal-copy">{access.message} You can submit a report without attachments.</p><ReportForm files={[]} onSubmitted={onSubmitted} /><button type="button" className="button button-yellow" onClick={() => void reload()}>Retry attachments</button></div>
  );
  return (
    <div className="post-modal-body">
      <p className="post-modal-copy">Tell the community what you lost or found. Add item details and photos or videos below.</p>
      <ReportForm files={access.status === "ready" ? access.files : []} onSubmitted={onSubmitted} onAttachmentsChanged={reload} />
    </div>
  );
}

export function PostModal() {
  const params = useSearchParams();
  if (params.get("compose") !== "1") return null;
  function close() {
    const url = new URL(window.location.href);
    url.searchParams.delete("compose");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }
  return <Dialog open onClose={close} title="Post an item" className="post-dialog"><PostContent onSubmitted={close} /></Dialog>;
}
