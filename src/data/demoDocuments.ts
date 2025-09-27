export interface DemoDocument {
  id: string;
  title: string;
  type: string;
  date: string;
  size?: string;
  snippet: string;
  content?: string;
}

export const demoDocuments: DemoDocument[] = [
  {
    id: "1",
    title: "Acme Cloud Migration Plan 2024",
    type: "Report",
    date: "2024-11-08",
    size: "2.4 MB",
    snippet: "Acme Inc. seeks to migrate 250 TB of on-prem data to a hybrid multi-cloud architecture over a 6-month period. Objectives: reduce TCO by 25%, improve disaster recovery RTO to < 2 hours.",
    content: "Acme Inc. seeks to migrate 250 TB of on-prem data to a hybrid multi-cloud architecture over a 6-month period. Objectives: reduce TCO by 25%, improve disaster recovery RTO to < 2 hours, and enable auto-scaling for peak traffic. Key phases: discovery, pilot migration, bulk migration, cutover, optimization. Major risks: data egress cost, legacy database compatibility, and compliance with GDPR/CCPA."
  },
  {
    id: "2",
    title: "Data Migration RFP - Sample",
    type: "RFP",
    date: "2024-08-15",
    size: "1.8 MB",
    snippet: "Client: MidCap Retailer. Project: End-to-End data center migration to cloud. Required: vendor to provide migration plan, staffing, testing, security hardening, and post-migration support for 12 months.",
    content: "Client: MidCap Retailer. Project: End-to-End data center migration to cloud. Required: vendor to provide migration plan, staffing, testing, security hardening, and post-migration support for 12 months. Budget: ~$500,000. Timeline: 6 months. Evaluation criteria: migration experience, cost, security controls, SLA & support."
  },
  {
    id: "3",
    title: "Cloud Security Requirements (Policy)",
    type: "Whitepaper",
    date: "2023-12-01",
    size: "1.2 MB",
    snippet: "Enterprises need layered security: identity & access management, data encryption at rest and in transit, continuous vulnerability scanning, and centralized logging (SIEM).",
    content: "Enterprises need layered security: identity & access management, data encryption at rest and in transit, continuous vulnerability scanning, and centralized logging (SIEM). Recommended controls: IAM least privilege, hardware-backed key management, and quarterly penetration testing."
  },
  {
    id: "4",
    title: "Case Study: Retailer X moves to multi-cloud",
    type: "Case Study",
    date: "2024-03-30",
    size: "900 KB",
    snippet: "Retailer X migrated web and analytics workloads to a multi-cloud setup using lift-and-shift and containerization for microservices. Outcome: 18% latency reduction, 22% infrastructure cost reduction.",
    content: "Retailer X migrated web and analytics workloads to a multi-cloud setup using lift-and-shift and containerization for microservices. Outcome: 18% latency reduction, 22% infrastructure cost reduction after optimization. Lessons learned: focus on dependency mapping and automated tests for data integrity."
  },
  {
    id: "5",
    title: "Marketing Campaign Brief: Launch 2025",
    type: "Brief",
    date: "2024-10-10",
    size: "750 KB",
    snippet: "Objective: 6-week acquisition push for new B2B SaaS offering. Target: mid-market IT teams. Deliverables: 3 sales enablement decks, 2 case studies, 10 social posts, one product demo video.",
    content: "Objective: 6-week acquisition push for new B2B SaaS offering. Target: mid-market IT teams. Deliverables: 3 sales enablement decks, 2 case studies, 10 social posts, one product demo video. Success metrics: MQLs and demo signups; expected CPL <$150."
  },
  {
    id: "6",
    title: "Vendor Comparison: Cloud Compute",
    type: "Comparison",
    date: "2024-06-05",
    size: "1.1 MB",
    snippet: "This matrix compares AWS, Azure, GCP compute offerings on price, instance types, managed services, and support options. All providers offer comparable VM families.",
    content: "This matrix compares AWS, Azure, GCP compute offerings on price, instance types, managed services, and support options. Short summary: All providers offer comparable VM families; GCP tends to be cheaper on certain continuous workloads; Azure provides enterprise integrations for MS-centric shops; AWS has the broadest managed service portfolio."
  },
  {
    id: "7",
    title: "Evaluation Criteria Template",
    type: "Template",
    date: "2024-01-20",
    size: "500 KB",
    snippet: "Evaluation criteria recommended: Technical Depth (30%), Cost (25%), Security & Compliance (20%), SLA & Uptime (15%), References & Past Projects (10%).",
    content: "Evaluation criteria recommended: Technical Depth (30%), Cost (25%), Security & Compliance (20%), SLA & Uptime (15%), References & Past Projects (10%)."
  },
  {
    id: "8",
    title: "Cloud Migration Strategy Presentation",
    type: "Slides",
    date: "2024-09-12",
    size: "3.2 MB",
    snippet: "Slide 1: Title — Cloud Migration Overview, Slide 2: Objectives — Reduce TCO, improve RTO, Slide 3: Timeline — 6 months, 4 major phases",
    content: "Slide 1: Title — Cloud Migration Overview\nSlide 2: Objectives — Reduce TCO, improve RTO\nSlide 3: Timeline — 6 months, 4 major phases\nSlide 4: Risks & Mitigation\nSlide 5: Cost & Budget overview\nSlide 6: Next steps & contact"
  },
  {
    id: "9",
    title: "Enterprise SaaS Implementation Guide",
    type: "Report",
    date: "2024-05-22",
    size: "2.1 MB",
    snippet: "Comprehensive guide for implementing enterprise SaaS solutions. Covers vendor selection, integration patterns, security requirements, and change management strategies.",
    content: "Comprehensive guide for implementing enterprise SaaS solutions. Covers vendor selection, integration patterns, security requirements, and change management strategies. Key success factors: executive sponsorship, phased rollout, and comprehensive training programs."
  },
  {
    id: "10",
    title: "Multi-Cloud Cost Optimization Strategy",
    type: "Report",
    date: "2024-07-18",
    size: "1.9 MB",
    snippet: "Organizations implementing multi-cloud strategies can reduce costs by 25-40% through automated workload placement and resource optimization across AWS, Azure, and GCP platforms.",
    content: "Organizations implementing multi-cloud strategies can reduce costs by 25-40% through automated workload placement and resource optimization across AWS, Azure, and GCP platforms. Key strategies include rightsizing instances, leveraging spot instances, and implementing automated governance policies."
  },
  {
    id: "11",
    title: "Data Governance Framework 2024",
    type: "Whitepaper",
    date: "2024-04-12",
    size: "1.6 MB",
    snippet: "Modern data governance requires automated classification, lineage tracking, and policy enforcement. Framework includes data stewardship roles, compliance monitoring, and privacy controls.",
    content: "Modern data governance requires automated classification, lineage tracking, and policy enforcement. Framework includes data stewardship roles, compliance monitoring, and privacy controls. Implementation typically takes 6-9 months with proper executive support."
  },
  {
    id: "12",
    title: "Digital Transformation Roadmap Template",
    type: "Template",
    date: "2024-02-28",
    size: "800 KB",
    snippet: "5-phase digital transformation roadmap: Assessment, Foundation, Pilot, Scale, Optimize. Includes success metrics, risk mitigation, and stakeholder engagement strategies.",
    content: "5-phase digital transformation roadmap: Assessment, Foundation, Pilot, Scale, Optimize. Includes success metrics, risk mitigation, and stakeholder engagement strategies. Timeline typically spans 18-24 months depending on organizational complexity."
  }
];

export const searchDocuments = (query: string): DemoDocument[] => {
  const lowQuery = query.toLowerCase();
  return demoDocuments.filter(doc => 
    doc.title.toLowerCase().includes(lowQuery) ||
    doc.snippet.toLowerCase().includes(lowQuery) ||
    doc.type.toLowerCase().includes(lowQuery) ||
    (doc.content && doc.content.toLowerCase().includes(lowQuery))
  ).slice(0, 3);
};