"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  Circle,
  AlertCircle,
  Loader2,
  XCircle,
  Calendar,
} from "lucide-react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";

// Type definitions
interface Subtask {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  tools?: string[]; // Optional array of MCP server tools
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  level: number;
  dependencies: string[];
  subtasks: Subtask[];
}

// Initial task data customized for Weez AI Planner
const initialTasks: Task[] = [
  {
    id: "1",
    title: "Brand Identity Sync",
    description: "Align AI with brand persona and historical context",
    status: "completed",
    priority: "high",
    level: 0,
    dependencies: [],
    subtasks: [
      {
        id: "1.1",
        title: "Memory Extraction",
        description: "Scanning Knowledge Base for brand voice and assets",
        status: "completed",
        priority: "high",
        tools: ["knowledge-base", "brand-persona"],
      },
      {
        id: "1.2",
        title: "Goal Alignment",
        description: "Mapping campaign objectives to business KPIs",
        status: "completed",
        priority: "high",
        tools: ["marketing-agent"],
      },
    ],
  },
  {
    id: "2",
    title: "Market Intelligence",
    description: "Intercepting signals and trend analysis",
    status: "in-progress",
    priority: "high",
    level: 0,
    dependencies: ["1"],
    subtasks: [
      {
        id: "2.1",
        title: "Competitor Intercept",
        description: "Analyzing recent competitor ad performance",
        status: "completed",
        priority: "medium",
        tools: ["signal-hub", "browser"],
      },
      {
        id: "2.2",
        title: "Trend Synthesis",
        description: "Identifying viral hooks and aesthetic shifts",
        status: "in-progress",
        priority: "high",
        tools: ["trend-engine"],
      },
    ],
  },
  {
    id: "3",
    title: "Strategic Pillar Design",
    description: "Constructing the marketing architecture",
    status: "pending",
    priority: "high",
    level: 0,
    dependencies: ["2"],
    subtasks: [
      {
        id: "3.1",
        title: "Pillar Definition",
        description: "Mapping content types to brand pillars",
        status: "pending",
        priority: "high",
        tools: ["strategic-hub"],
      },
      {
        id: "3.2",
        title: "Content Mix Calculation",
        description: "Optimizing posting frequency and variety",
        status: "pending",
        priority: "medium",
        tools: ["content-architect"],
      },
    ],
  },
  {
    id: "4",
    title: "Tactical Generation",
    description: "Creating visuals and copy for the campaign",
    status: "pending",
    priority: "medium",
    level: 1,
    dependencies: ["3"],
    subtasks: [
      {
        id: "4.1",
        title: "Visual Asset Selection",
        description: "Picking templates and generating AI imagery",
        status: "pending",
        priority: "high",
        tools: ["poster-designer", "imagen-engine"],
      },
      {
        id: "4.2",
        title: "Copy Hook Writing",
        description: "Generating captions and hashtag strategy",
        status: "pending",
        priority: "medium",
        tools: ["copy-agent"],
      },
    ],
  },
];

export default function Plan() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [expandedTasks, setExpandedTasks] = useState<string[]>(["2"]);
  const [expandedSubtasks, setExpandedSubtasks] = useState<{
    [key: string]: boolean;
  }>({});
  
  // Reduced motion preference logic
  const prefersReducedMotion = 
    typeof window !== 'undefined' 
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches 
      : false;

  const toggleTaskExpansion = (taskId: string) => {
    setExpandedTasks((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId],
    );
  };

  const toggleSubtaskExpansion = (taskId: string, subtaskId: string) => {
    const key = `${taskId}-${subtaskId}`;
    setExpandedSubtasks((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleTaskStatus = (taskId: string) => {
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id === taskId) {
          const statuses = ["completed", "in-progress", "pending", "need-help", "failed"];
          const currentIndex = Math.floor(Math.random() * statuses.length);
          const newStatus = statuses[currentIndex];

          const updatedSubtasks = task.subtasks.map((subtask) => ({
            ...subtask,
            status: newStatus === "completed" ? "completed" : subtask.status,
          }));

          return {
            ...task,
            status: newStatus,
            subtasks: updatedSubtasks,
          };
        }
        return task;
      }),
    );
  };

  const toggleSubtaskStatus = (taskId: string, subtaskId: string) => {
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id === taskId) {
          const updatedSubtasks = task.subtasks.map((subtask) => {
            if (subtask.id === subtaskId) {
              const newStatus =
                subtask.status === "completed" ? "pending" : "completed";
              return { ...subtask, status: newStatus };
            }
            return subtask;
          });

          const allSubtasksCompleted = updatedSubtasks.every(
            (s) => s.status === "completed",
          );

          return {
            ...task,
            subtasks: updatedSubtasks,
            status: allSubtasksCompleted ? "completed" : task.status,
          };
        }
        return task;
      }),
    );
  };

  // Animation variants
  const taskVariants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : -5 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
    exit: { opacity: 0, y: prefersReducedMotion ? 0 : -5, transition: { duration: 0.15 } }
  };

  const subtaskListVariants = {
    hidden: { opacity: 0, height: 0, overflow: "hidden" },
    visible: { 
      height: "auto", 
      opacity: 1, 
      overflow: "visible", 
      transition: { duration: 0.25, staggerChildren: 0.05 } 
    },
    exit: { height: 0, opacity: 0, overflow: "hidden", transition: { duration: 0.2 } }
  };

  const subtaskVariants = {
    hidden: { opacity: 0, x: prefersReducedMotion ? 0 : -10 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.2 } }
  };

  return (
    <div className="bg-transparent text-foreground h-full overflow-auto">
      <motion.div 
        className="bg-white/80 backdrop-blur-sm border-gray-100 rounded-3xl border shadow-lg overflow-hidden"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <LayoutGroup>
          <div className="p-6 overflow-hidden">
            <div className="flex items-center gap-2 mb-4 px-3">
               <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-white" />
               </div>
               <div>
                  <p className="text-xs font-bold text-gray-900 uppercase tracking-wide">Building Content Plan</p>
                  <p className="text-[10px] text-gray-400">AI is mapping your strategy...</p>
               </div>
            </div>
            
            <ul className="space-y-1 overflow-hidden">
              {tasks.map((task, index) => {
                const isExpanded = expandedTasks.includes(task.id);
                const isCompleted = task.status === "completed";

                return (
                  <motion.li
                    key={task.id}
                    className={`${index !== 0 ? "mt-1 pt-2" : ""}`}
                    initial="hidden"
                    animate="visible"
                    variants={taskVariants}
                  >
                    <motion.div 
                      className="group flex items-center px-3 py-2 rounded-xl"
                      whileHover={{ backgroundColor: "rgba(0,0,0,0.02)" }}
                    >
                      <div
                        className="mr-3 flex-shrink-0 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTaskStatus(task.id);
                        }}
                      >
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={task.status}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                          >
                            {task.status === "completed" ? (
                              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                            ) : task.status === "in-progress" ? (
                              <Loader2 className="h-5 w-5 text-blue-500 animate-spin-slow" />
                            ) : task.status === "need-help" ? (
                              <AlertCircle className="h-5 w-5 text-yellow-500" />
                            ) : task.status === "failed" ? (
                              <XCircle className="h-5 w-5 text-red-500" />
                            ) : (
                              <Circle className="text-muted-foreground/30 h-5 w-5" />
                            )}
                          </motion.div>
                        </AnimatePresence>
                      </div>

                      <div
                        className="flex min-w-0 flex-grow cursor-pointer items-center justify-between"
                        onClick={() => toggleTaskExpansion(task.id)}
                      >
                        <div className="mr-2 flex-1 truncate">
                          <span
                            className={`text-sm font-semibold ${isCompleted ? "text-muted-foreground/60 line-through" : "text-gray-800"}`}
                          >
                            {task.title}
                          </span>
                        </div>

                        <div className="flex flex-shrink-0 items-center space-x-2 text-[10px]">
                          <span
                            className={`rounded-full px-2 py-0.5 font-bold uppercase tracking-wider ${
                              task.status === "completed"
                                ? "bg-emerald-50 text-emerald-600"
                                : task.status === "in-progress"
                                  ? "bg-blue-50 text-blue-600"
                                  : task.status === "need-help"
                                    ? "bg-yellow-50 text-yellow-600"
                                    : "bg-gray-50 text-gray-400"
                            }`}
                          >
                            {task.status}
                          </span>
                        </div>
                      </div>
                    </motion.div>

                    <AnimatePresence>
                      {isExpanded && task.subtasks.length > 0 && (
                        <motion.div 
                          className="relative overflow-hidden ml-5"
                          variants={subtaskListVariants}
                          initial="hidden"
                          animate="visible"
                          exit="hidden"
                        >
                          <div className="absolute top-0 bottom-2 left-[12px] border-l border-dashed border-gray-200" />
                          <ul className="mt-1 space-y-1">
                            {task.subtasks.map((subtask) => {
                              const subtaskKey = `${task.id}-${subtask.id}`;
                              const isSubtaskExpanded = expandedSubtasks[subtaskKey];

                              return (
                                <motion.li
                                  key={subtask.id}
                                  className="group flex flex-col pl-6"
                                  variants={subtaskVariants}
                                >
                                  <div 
                                    className="flex items-center rounded-lg p-1.5 hover:bg-gray-50 transition-colors cursor-pointer"
                                    onClick={() => toggleSubtaskExpansion(task.id, subtask.id)}
                                  >
                                    <div
                                      className="mr-2.5 flex-shrink-0"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleSubtaskStatus(task.id, subtask.id);
                                      }}
                                    >
                                      {subtask.status === "completed" ? (
                                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                      ) : subtask.status === "in-progress" ? (
                                        <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />
                                      ) : (
                                        <Circle className="text-gray-200 h-4 w-4" />
                                      )}
                                    </div>

                                    <span
                                      className={`text-xs font-medium ${subtask.status === "completed" ? "text-gray-400 line-through" : "text-gray-600"}`}
                                    >
                                      {subtask.title}
                                    </span>
                                  </div>

                                  <AnimatePresence>
                                    {isSubtaskExpanded && (
                                      <motion.div 
                                        className="text-gray-400 border-l border-dashed border-gray-100 mt-0.5 ml-2 pl-4 text-[10px] leading-relaxed"
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                      >
                                        <p className="pb-2">{subtask.description}</p>
                                        {subtask.tools && (
                                          <div className="flex flex-wrap gap-1 pb-2">
                                            {subtask.tools.map((tool, idx) => (
                                              <span key={idx} className="bg-gray-50 text-gray-500 rounded px-1.5 py-0.5 font-mono">
                                                {tool}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </motion.li>
                              );
                            })}
                          </ul>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.li>
                );
              })}
            </ul>
          </div>
        </LayoutGroup>
      </motion.div>
    </div>
  );
}
