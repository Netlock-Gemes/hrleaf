import { pageImage } from "@/lib/og";

export const alt = "HRLeaf privacy policy";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return pageImage({
    title: "Privacy Policy",
    subtitle: "How HRLeaf handles notes, links and the little data it keeps.",
  });
}
