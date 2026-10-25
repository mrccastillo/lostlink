import backpack from "../../../public/designs/assets/backpack.jpg";
import headphones from "../../../public/designs/assets/headphones.jpg";
import camera from "../../../public/designs/assets/camera.jpg";

export { backpack };

// Illustrative marketing content, never a fallback for live organization reports.
export const sampleReports = [
  {
    id: "backpack",
    title: "Someone’s sidekick.",
    name: "Navy backpack",
    status: "found",
    location: "Library",
    category: "Bags & accessories",
    image: backpack,
    alt: "Navy backpack resting against a wall in the afternoon light",
    description:
      "An everyday backpack left near the library seating area. A little detail about what’s inside could help connect it to its owner.",
  },
  {
    id: "headphones",
    title: "Missing your beats?",
    name: "Over-ear headphones",
    status: "found",
    location: "Student commons",
    category: "Electronics",
    image: headphones,
    alt: "Black over-ear headphones beside a keyboard on a white desk",
    description:
      "A pair of headphones waiting for its next playlist. In LostLink, identifying details are shared privately with the team reviewing a claim.",
  },
  {
    id: "camera",
    title: "Memories on the run.",
    name: "Black camera",
    status: "lost",
    location: "Courtyard",
    category: "Electronics",
    image: camera,
    alt: "A black camera and interchangeable lenses on a dark surface",
    description:
      "A camera with plenty of stories left to tell. A found-item report could be the first step toward getting it back to its owner.",
  },
] as const;

export const recoverySteps = [
  {
    title: "Put it out there.",
    description:
      "Lost something? Found something? Add a photo, a place, and the details that help people recognize it.",
  },
  {
    title: "Connect the dots.",
    description:
      "Check possible matches. Share proof privately with staff so the right thing goes to the right person.",
  },
  {
    title: "Make the comeback.",
    description:
      "Get your claim approved, arrange a handoff, and give that story a better ending.",
  },
] as const;

export const faqs = [
  {
    question: "Can I post a lost or found item yet?",
    answer:
      "Start with Post an item to log in or create an account. Verify your email and get community access approved. The reporting form is coming next; if you need help with an item now, contact your organization’s lost-and-found team.",
  },
  {
    question: "What should I do if I find something?",
    answer:
      "Note where and when you found it, take a clear photo, and bring it to your organization’s designated lost-and-found team. Keep serial numbers and other unique details private so the owner can use them to verify a claim.",
  },
  {
    question: "How will ownership be verified?",
    answer:
      "Claimants will share identifying details or proof privately with authorized staff. Staff will review each claim before approving a handoff. A possible match alone does not confirm ownership.",
  },
  {
    question: "Who will be able to see my report?",
    answer:
      "Published reports will be visible to verified members of your organization. Ownership evidence and contact details will stay out of the public report. The items on this page are examples, not real member reports.",
  },
] as const;
