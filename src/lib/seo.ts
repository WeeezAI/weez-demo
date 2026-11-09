import { useEffect } from "react";

/** Per-route head tags for the public pages. Sets title, description, canonical, Open Graph
    and an optional JSON-LD block, and restores the landing defaults on unmount. */
export type Seo = {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
  image?: string;
  jsonLd?: object;
};

const ORIGIN = "https://www.dexraflow.com";

const setMeta = (sel: string, attrs: Record<string, string>) => {
  let el = document.head.querySelector<HTMLMetaElement>(sel);
  if (!el) {
    el = document.createElement("meta");
    document.head.appendChild(el);
  }
  const prev = el.getAttribute("content");
  Object.entries(attrs).forEach(([k, v]) => el!.setAttribute(k, v));
  return () => {
    if (prev === null) el?.remove();
    else el?.setAttribute("content", prev);
  };
};

export const useSeo = ({ title, description, path, type = "website", image = `${ORIGIN}/og-image.png`, jsonLd }: Seo) => {
  useEffect(() => {
    const url = `${ORIGIN}${path}`;
    const prevTitle = document.title;
    document.title = title;
    const undo = [
      setMeta('meta[name="description"]', { name: "description", content: description }),
      setMeta('meta[property="og:title"]', { property: "og:title", content: title }),
      setMeta('meta[property="og:description"]', { property: "og:description", content: description }),
      setMeta('meta[property="og:url"]', { property: "og:url", content: url }),
      setMeta('meta[property="og:type"]', { property: "og:type", content: type }),
      setMeta('meta[property="og:image"]', { property: "og:image", content: image }),
      setMeta('meta[name="twitter:title"]', { name: "twitter:title", content: title }),
      setMeta('meta[name="twitter:description"]', { name: "twitter:description", content: description }),
      setMeta('meta[name="twitter:image"]', { name: "twitter:image", content: image }),
    ];
    const canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const prevCanonical = canonical?.href;
    if (canonical) canonical.href = url;

    let script: HTMLScriptElement | null = null;
    if (jsonLd) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.dataset.route = "1";
      script.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }
    return () => {
      document.title = prevTitle;
      undo.forEach((u) => u());
      if (canonical && prevCanonical) canonical.href = prevCanonical;
      script?.remove();
    };
  }, [title, description, path, type, image, jsonLd]);
};
