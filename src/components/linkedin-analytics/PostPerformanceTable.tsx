import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PostMetric } from "@/services/linkedinAnalyticsAPI";
import { Trophy, MessageSquare, Heart, Share2, Eye, FileText } from "lucide-react";

interface PostPerformanceTableProps {
  posts: PostMetric[];
  avgEngagementRate: number;
}

const contentTypeColors: Record<string, string> = {
  text: "bg-slate-100 text-slate-600",
  image: "bg-blue-100 text-blue-600",
  video: "bg-purple-100 text-purple-600",
  article: "bg-amber-100 text-amber-600",
  poll: "bg-green-100 text-green-600",
  document: "bg-rose-100 text-rose-600",
};

const PostPerformanceTable = ({ posts, avgEngagementRate }: PostPerformanceTableProps) => {
  if (!posts || posts.length === 0) {
    return (
      <Card className="border-none bg-white rounded-[2.5rem] p-10">
        <div className="text-center py-16 space-y-4">
          <div className="p-4 rounded-2xl bg-muted/30 inline-flex">
            <FileText className="w-10 h-10 text-muted-foreground/30" />
          </div>
          <h3 className="text-lg font-black text-muted-foreground/40">No posts in this period</h3>
          <p className="text-xs text-muted-foreground/30">Start posting to see performance data here.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-none bg-white rounded-[2.5rem] overflow-hidden shadow-sm">
      <div className="p-8 pb-4 flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-xl font-black tracking-tight uppercase">Post Performance.</h3>
          <p className="text-xs font-bold text-muted-foreground/40">
            {posts.length} posts · Avg engagement: {avgEngagementRate}%
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/20">
              <th className="text-left px-8 py-3 text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">Post</th>
              <th className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">Type</th>
              <th className="text-right px-4 py-3 text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">Impressions</th>
              <th className="text-right px-4 py-3 text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">Reactions</th>
              <th className="text-right px-4 py-3 text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">Comments</th>
              <th className="text-right px-4 py-3 text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">Shares</th>
              <th className="text-right px-8 py-3 text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">Eng Rate</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post, idx) => {
              const isTop = post.engagement_rate > avgEngagementRate && avgEngagementRate > 0;
              return (
                <tr
                  key={post.post_urn || idx}
                  className={cn(
                    "border-b border-border/10 transition-colors hover:bg-muted/30",
                    isTop && "bg-amber-50/30"
                  )}
                >
                  <td className="px-8 py-4 max-w-[300px]">
                    <div className="flex items-start gap-3">
                      {isTop && (
                        <Trophy className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className="text-sm font-bold text-foreground/80 line-clamp-2 leading-relaxed">
                          {post.text_snippet || "—"}
                        </p>
                        <p className="text-[10px] font-bold text-muted-foreground/40 mt-1">
                          {post.posted_at
                            ? new Date(post.posted_at).toLocaleDateString([], {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "—"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <Badge
                      className={cn(
                        "text-[8px] font-black uppercase tracking-widest border-none px-2.5 py-1 rounded-lg",
                        contentTypeColors[post.content_type] || contentTypeColors.text
                      )}
                    >
                      {post.content_type}
                    </Badge>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Eye className="w-3 h-3 text-muted-foreground/30" />
                      <span className="text-sm font-black">{(post.impressions || 0).toLocaleString()}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Heart className="w-3 h-3 text-red-400" />
                      <span className="text-sm font-black">{post.reactions}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <MessageSquare className="w-3 h-3 text-blue-400" />
                      <span className="text-sm font-black">{post.comments}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Share2 className="w-3 h-3 text-green-400" />
                      <span className="text-sm font-black">{post.shares}</span>
                    </div>
                  </td>
                  <td className="px-8 py-4 text-right">
                    <span
                      className={cn(
                        "text-sm font-black",
                        post.engagement_rate > avgEngagementRate
                          ? "text-emerald-500"
                          : "text-foreground/70"
                      )}
                    >
                      {post.engagement_rate}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default PostPerformanceTable;
