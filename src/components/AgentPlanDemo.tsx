"use client";

import Plan from "@/components/ui/agent-plan";

export default function AgentPlanDemo() {
  return (
    <div className="flex flex-col p-8 w-full h-full bg-gray-50/30 rounded-[2.5rem] border border-gray-100">
      <div className="max-w-md mx-auto w-full">
        <Plan />
      </div>
    </div>
  );
}
