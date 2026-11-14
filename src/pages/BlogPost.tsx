import { useMemo } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, ArrowRight } from "lucide-react";
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

const CTA_BTN = `group inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-dx-brand px-5 text-[14px] font-medium text-white transition hover:bg-dx-brand-hover active:scale-[0.98] ${FOCUS}`;
const Arrow = () => <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" strokeWidth={1.5} aria-hidden="true" />;

/** The intro (everything before the first H2) and the rest, so a callout can sit between them without editing the text. */
const splitAtFirstH2 = (body: string): [string, string] => {
  const i = body.search(/^## /m);
  return i < 0 ? [body, ""] : [body.slice(0, i), body.slice(i)];
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
  const [intro, rest] = splitAtFirstH2(post.body);

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
          {post.callout ? (
            <>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
                {intro}
              </ReactMarkdown>
              <aside aria-label="Free self-check" className="mt-8 rounded-[8px] border border-dx-line border-l-[3px] border-l-dx-brand bg-dx-raised p-5 sm:flex sm:items-center sm:gap-6 sm:p-6">
                <p className="text-[16px] leading-relaxed text-dx-ink sm:flex-1">{post.callout.text}</p>
                <Link to={post.callout.href} className={`${CTA_BTN} mt-4 w-full shrink-0 sm:mt-0 sm:w-auto`}>
                  {post.callout.cta} <Arrow />
                </Link>
              </aside>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
                {rest}
              </ReactMarkdown>
            </>
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
              {post.body}
            </ReactMarkdown>
          )}
        </div>

        {post.closing && (
          <section aria-labelledby="closing-title" className="mt-12">
            <h2 id="closing-title" className="scroll-mt-28 text-[26px] font-semibold leading-tight tracking-[-0.02em] text-dx-ink sm:text-[30px]">
              {post.closing.title}
            </h2>
            <p className="mt-5 text-[17px] leading-[1.7] text-dx-ink-muted">{post.closing.body}</p>
            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
              <a href={post.closing.href} target="_blank" rel="noopener noreferrer" className={CTA_BTN}>
                {post.closing.cta} <Arrow />
              </a>
              {post.closing.secondary && (
                <Link to={post.closing.secondary.href} className={`rounded text-[15px] font-medium text-dx-brand underline decoration-dx-brand/40 underline-offset-4 transition hover:decoration-dx-brand ${FOCUS}`}>
                  {post.closing.secondary.label}
                </Link>
              )}
            </div>
          </section>
        )}

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
