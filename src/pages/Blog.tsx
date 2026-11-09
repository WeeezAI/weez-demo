import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { BlogLayout, fmtDate } from "@/components/blog/BlogLayout";
import { FOCUS } from "@/components/landing/primitives";
import { POSTS } from "@/content/blog";
import { useSeo } from "@/lib/seo";

const Blog = () => {
  useSeo({
    title: "Blog: lead leakage and GTM automation failures | Dexraflow",
    description: "Plain-language guides on lead leakage, silent GTM automation failures, and how to find the leads your HubSpot, Salesforce and Zapier workflows dropped.",
    path: "/blog",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Blog",
      "@id": "https://www.dexraflow.com/blog#blog",
      name: "Dexraflow Blog",
      url: "https://www.dexraflow.com/blog",
      publisher: { "@id": "https://www.dexraflow.com/#org" },
      blogPost: POSTS.map((p) => ({ "@type": "BlogPosting", headline: p.title, url: `https://www.dexraflow.com/blog/${p.slug}`, datePublished: p.date })),
    },
  });

  return (
    <BlogLayout>
      <div className="mx-auto max-w-6xl">
        <p className="font-dx-mono text-[12px] font-medium uppercase tracking-[0.08em] text-dx-ink-muted">Blog</p>
        <h1 className="mt-4 max-w-3xl text-[36px] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-[48px]">Lead leakage and GTM automation failures, in plain language.</h1>
        <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-dx-ink-muted">Where leads go missing between your tools, why nothing alerts you, and how to find them. Written for RevOps.</p>

        <ul className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {POSTS.map((p) => (
            <li key={p.slug} className="min-w-0">
              <Link to={`/blog/${p.slug}`} className={`group flex h-full flex-col rounded-[8px] border border-dx-line bg-dx-raised p-6 transition-shadow duration-300 hover:shadow-dx-overlay ${FOCUS}`}>
                <p className="font-dx-mono text-[12px] font-medium uppercase tracking-[0.08em] text-dx-ink-muted">{p.tags[0]}</p>
                <h2 className="mt-3 text-[20px] font-semibold leading-snug tracking-[-0.01em] text-dx-ink">{p.title}</h2>
                <p className="mt-3 flex-1 text-[15px] leading-relaxed text-dx-ink-muted">{p.description}</p>
                <p className="mt-6 flex items-center justify-between text-[13px] text-dx-ink-muted">
                  <span>
                    <time dateTime={p.date}>{fmtDate(p.date)}</time> · {p.readMinutes} min read
                  </span>
                  <span className="inline-flex items-center gap-1 font-medium text-dx-brand">
                    Read <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" strokeWidth={1.5} aria-hidden="true" />
                  </span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </BlogLayout>
  );
};

export default Blog;
