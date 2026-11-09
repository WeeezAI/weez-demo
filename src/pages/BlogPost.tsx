import { useMemo } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft } from "lucide-react";
import { AuditCta, BlogLayout, fmtDate } from "@/components/blog/BlogLayout";
import { FOCUS } from "@/components/landing/primitives";
import { POSTS, findPost } from "@/content/blog";
import { useSeo } from "@/lib/seo";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

const text = (n: unknown): string => (Array.isArray(n) ? n.map(text).join("") : typeof n === "string" ? n : n && typeof n === "object" && "props" in (n as object) ? text((n as { props: { children?: unknown } }).props.children) : "");

/* Markdown rendered in the design system's type. Internal links use the router so the SPA doesn't reload. */
const components: Components = {
  h2: ({ children }) => (
    <h2 id={slugify(text(children))} className="mt-12 scroll-mt-28 text-[26px] font-semibold leading-tight tracking-[-0.02em] text-dx-ink sm:text-[30px]">
      {children}
    </h2>
  ),
  h3: ({ children }) => <h3 className="mt-8 text-[19px] font-semibold leading-snug text-dx-ink">{children}</h3>,
  p: ({ children }) => <p className="mt-5 text-[17px] leading-[1.7] text-dx-ink-muted">{children}</p>,
  ul: ({ children }) => <ul className="mt-5 list-disc space-y-2 pl-6 text-[17px] leading-[1.7] text-dx-ink-muted marker:text-dx-brand">{children}</ul>,
  ol: ({ children }) => <ol className="mt-5 list-decimal space-y-2 pl-6 text-[17px] leading-[1.7] text-dx-ink-muted marker:font-medium marker:text-dx-ink">{children}</ol>,
  li: ({ children }) => <li className="pl-1">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-dx-ink">{children}</strong>,
  a: ({ href = "", children }) =>
    href.startsWith("/") ? (
      <Link to={href} className={`font-medium text-dx-brand underline decoration-dx-brand/40 underline-offset-4 transition hover:decoration-dx-brand ${FOCUS} rounded`}>
        {children}
      </Link>
    ) : (
      <a href={href} className={`font-medium text-dx-brand underline decoration-dx-brand/40 underline-offset-4 transition hover:decoration-dx-brand ${FOCUS} rounded`} rel="noopener">
        {children}
      </a>
    ),
  table: ({ children }) => (
    <div className="mt-6 overflow-x-auto rounded-[8px] border border-dx-line">
      <table className="w-full min-w-[520px] border-collapse text-left text-[15px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-dx-sunken font-dx-mono text-[12px] font-medium uppercase tracking-[0.06em] text-dx-ink-muted">{children}</thead>,
  th: ({ children }) => <th className="border-b border-dx-line px-4 py-3 font-medium">{children}</th>,
  td: ({ children }) => <td className="border-b border-dx-line px-4 py-3 align-top text-dx-ink-muted last:border-b-0">{children}</td>,
  tr: ({ children }) => <tr className="[&:last-child>td]:border-b-0">{children}</tr>,
  blockquote: ({ children }) => <blockquote className="mt-6 border-l-2 border-dx-brand pl-5 text-dx-ink">{children}</blockquote>,
  hr: () => <hr className="my-10 border-dx-line" />,
  code: ({ children }) => <code className="rounded bg-dx-sunken px-1.5 py-0.5 font-dx-mono text-[14px] text-dx-ink">{children}</code>,
};

const BlogPost = () => {
  const { slug } = useParams();
  const post = findPost(slug);
  const url = `https://www.dexraflow.com/blog/${post?.slug ?? ""}`;

  const jsonLd = useMemo(
    () =>
      post && {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "BlogPosting",
            "@id": `${url}#article`,
            headline: post.title,
            description: post.description,
            datePublished: post.date,
            dateModified: post.date,
            keywords: post.tags.join(", "),
            inLanguage: "en",
            mainEntityOfPage: url,
            author: { "@type": "Organization", name: "Dexraflow", url: "https://www.dexraflow.com" },
            publisher: { "@id": "https://www.dexraflow.com/#org" },
            image: "https://www.dexraflow.com/og-image.png",
          },
          {
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: "https://www.dexraflow.com/" },
              { "@type": "ListItem", position: 2, name: "Blog", item: "https://www.dexraflow.com/blog" },
              { "@type": "ListItem", position: 3, name: post.title, item: url },
            ],
          },
        ],
      },
    [post, url],
  );

  useSeo({
    title: post ? `${post.title} | Dexraflow` : "Article not found | Dexraflow",
    description: post?.description ?? "",
    path: post ? `/blog/${post.slug}` : "/blog",
    type: "article",
    jsonLd: jsonLd || undefined,
  });

  if (!post) return <Navigate to="/blog" replace />;

  const others = POSTS.filter((p) => p.slug !== post.slug).slice(0, 2);

  return (
    <BlogLayout>
      <article className="mx-auto max-w-3xl">
        <Link to="/blog" className={`inline-flex items-center gap-1.5 rounded text-[13px] font-medium text-dx-ink-muted transition hover:text-dx-ink ${FOCUS}`}>
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> All articles
        </Link>
        <p className="mt-8 font-dx-mono text-[12px] font-medium uppercase tracking-[0.08em] text-dx-ink-muted">{post.tags.join(" · ")}</p>
        <h1 className="mt-4 text-[34px] font-semibold leading-[1.08] tracking-[-0.03em] text-dx-ink sm:text-[44px]">{post.title}</h1>
        <p className="mt-5 text-[18px] leading-relaxed text-dx-ink-muted">{post.description}</p>
        <p className="mt-5 text-[13px] text-dx-ink-muted">
          <time dateTime={post.date}>{fmtDate(post.date)}</time> · {post.readMinutes} min read · Dexraflow
        </p>
        <hr className="mt-8 border-dx-line" />

        <div className="mt-2">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
            {post.body}
          </ReactMarkdown>
        </div>

        <AuditCta />

        {others.length > 0 && (
          <nav aria-label="More articles" className="mt-14">
            <p className="font-dx-mono text-[12px] font-medium uppercase tracking-[0.08em] text-dx-ink-muted">Keep reading</p>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2">
              {others.map((p) => (
                <li key={p.slug}>
                  <Link to={`/blog/${p.slug}`} className={`block h-full rounded-[8px] border border-dx-line bg-dx-raised p-5 transition-shadow duration-300 hover:shadow-dx-overlay ${FOCUS}`}>
                    <p className="text-[16px] font-semibold leading-snug text-dx-ink">{p.title}</p>
                    <p className="mt-2 text-[13px] text-dx-ink-muted">{p.readMinutes} min read</p>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </article>
    </BlogLayout>
  );
};

export default BlogPost;
