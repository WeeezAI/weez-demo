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
    size: "2.3 MB",
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
    title: "Cloud Security Requirements Policy",
    type: "Whitepaper", 
    date: "2023-12-01",
    size: "3.1 MB",
    snippet: "Enterprises need layered security: identity & access management, data encryption at rest and in transit, continuous vulnerability scanning, and centralized logging (SIEM).",
    content: "Enterprises need layered security: identity & access management, data encryption at rest and in transit, continuous vulnerability scanning, and centralized logging (SIEM). Recommended controls: IAM least privilege, hardware-backed key management, and quarterly penetration testing."
  },
  {
    id: "4",
    title: "Case Study: Retailer X Multi-Cloud Migration",
    type: "Case Study",
    date: "2024-03-30", 
    size: "1.5 MB",
    snippet: "Retailer X migrated web and analytics workloads to a multi-cloud setup using lift-and-shift and containerization for microservices. Outcome: 18% latency reduction, 22% infrastructure cost reduction.",
    content: "Retailer X migrated web and analytics workloads to a multi-cloud setup using lift-and-shift and containerization for microservices. Outcome: 18% latency reduction, 22% infrastructure cost reduction after optimization. Lessons learned: focus on dependency mapping and automated tests for data integrity."
  },
  {
    id: "5",
    title: "Marketing Campaign Brief: Launch 2025",
    type: "Brief",
    date: "2024-10-10",
    size: "950 KB", 
    snippet: "Objective: 6-week acquisition push for new B2B SaaS offering. Target: mid-market IT teams. Deliverables: 3 sales enablement decks, 2 case studies, 10 social posts, one product demo video.",
    content: "Objective: 6-week acquisition push for new B2B SaaS offering. Target: mid-market IT teams. Deliverables: 3 sales enablement decks, 2 case studies, 10 social posts, one product demo video. Success metrics: MQLs and demo signups; expected CPL <$150."
  },
  {
    id: "6",
    title: "Vendor Comparison: Cloud Compute", 
    type: "Comparison",
    date: "2024-06-05",
    size: "2.7 MB",
    snippet: "This matrix compares AWS, Azure, GCP compute offerings on price, instance types, managed services, and support options. All providers offer comparable VM families.",
    content: "This matrix compares AWS, Azure, GCP compute offerings on price, instance types, managed services, and support options. Short summary: All providers offer comparable VM families; GCP tends to be cheaper on certain continuous workloads; Azure provides enterprise integrations for MS-centric shops; AWS has the broadest managed service portfolio."
  },
  {
    id: "7",
    title: "Evaluation Criteria Template",
    type: "Template",
    date: "2024-01-20", 
    size: "640 KB",
    snippet: "Evaluation criteria recommended: Technical Depth (30%), Cost (25%), Security & Compliance (20%), SLA & Uptime (15%), References & Past Projects (10%).",
    content: "Evaluation criteria recommended: Technical Depth (30%), Cost (25%), Security & Compliance (20%), SLA & Uptime (15%), References & Past Projects (10%)."
  },
  {
    id: "8",
    title: "Cloud Migration Presentation Slides",
    type: "Slides",
    date: "2024-09-12",
    size: "4.2 MB", 
    snippet: "Slide 1: Title — Cloud Migration Overview, Slide 2: Objectives — Reduce TCO, improve RTO, Slide 3: Timeline — 6 months, 4 major phases",
    content: "Slide 1: Title — Cloud Migration Overview\nSlide 2: Objectives — Reduce TCO, improve RTO\nSlide 3: Timeline — 6 months, 4 major phases\nSlide 4: Risks & Mitigation\nSlide 5: Cost & Budget overview\nSlide 6: Next steps & contact"
  },
  {
    id: "9",
    title: "Enterprise DevOps Transformation Guide",
    type: "Guide",
    date: "2024-07-22",
    size: "3.8 MB",
    snippet: "A comprehensive guide for enterprise DevOps adoption including CI/CD pipeline setup, containerization strategies, monitoring and observability frameworks.",
    content: "A comprehensive guide for enterprise DevOps adoption including CI/CD pipeline setup, containerization strategies, monitoring and observability frameworks. Key metrics: deployment frequency, lead time, MTTR, and change failure rate. Recommended tools: Jenkins, GitLab, Docker, Kubernetes, Prometheus."
  },
  {
    id: "10",
    title: "Multi-Cloud Cost Optimization Report",
    type: "Report",
    date: "2024-05-14",
    size: "2.1 MB",
    snippet: "Analysis of cost optimization strategies across AWS, Azure, and GCP. Key findings: Reserved instances save 30-60%, auto-scaling reduces costs by 25%, proper tagging enables 15% savings.",
    content: "Analysis of cost optimization strategies across AWS, Azure, and GCP. Key findings: Reserved instances save 30-60%, auto-scaling reduces costs by 25%, proper tagging enables 15% savings through better allocation. Recommendations include right-sizing instances, leveraging spot instances, and implementing FinOps practices."
  },
  {
    id: "11",
    title: "SaaS Security Assessment Framework",
    type: "Framework",
    date: "2024-04-03",
    size: "1.9 MB",
    snippet: "Comprehensive security assessment framework for SaaS vendors including data protection, access controls, incident response, and compliance requirements (SOC2, ISO27001, GDPR).",
    content: "Comprehensive security assessment framework for SaaS vendors including data protection, access controls, incident response, and compliance requirements (SOC2, ISO27001, GDPR). Assessment categories: Identity Management, Data Security, Infrastructure Security, Application Security, Compliance & Governance."
  },
  {
    id: "12",
    title: "Digital Transformation ROI Analysis",
    type: "Analysis",
    date: "2024-02-18",
    size: "1.7 MB",
    snippet: "ROI analysis for digital transformation initiatives. Average ROI: 3.2x over 24 months. Key success factors: executive sponsorship, change management, employee training.",
    content: "ROI analysis for digital transformation initiatives. Average ROI: 3.2x over 24 months. Key success factors: executive sponsorship, change management, employee training, and phased implementation. Risk mitigation: proof of concepts, pilot programs, vendor evaluation frameworks."
  },
  {
    id: "13",
    title: "API Integration Best Practices",
    type: "Best Practices",
    date: "2024-08-09",
    size: "1.4 MB",
    snippet: "Best practices for enterprise API integration including RESTful design principles, authentication & authorization (OAuth 2.0, API keys), rate limiting, versioning strategies.",
    content: "Best practices for enterprise API integration including RESTful design principles, authentication & authorization (OAuth 2.0, API keys), rate limiting, versioning strategies, error handling, monitoring & logging. Recommended tools: Postman, Swagger, API Gateway services."
  },
  {
    id: "14",
    title: "Cloud Native Architecture Patterns",
    type: "Architecture Guide",
    date: "2024-06-27",
    size: "4.1 MB",
    snippet: "Modern cloud-native architecture patterns including microservices, serverless computing, container orchestration, service mesh, and event-driven architectures.",
    content: "Modern cloud-native architecture patterns including microservices, serverless computing, container orchestration, service mesh, and event-driven architectures. Design principles: scalability, resilience, observability, security. Technology stack recommendations and implementation guidelines."
  },
  {
    id: "15",
    title: "Data Governance Implementation Roadmap",
    type: "Roadmap",
    date: "2024-01-31",
    size: "2.5 MB",
    snippet: "12-month roadmap for implementing enterprise data governance including data classification, lineage tracking, quality management, and privacy compliance.",
    content: "12-month roadmap for implementing enterprise data governance including data classification, lineage tracking, quality management, and privacy compliance. Key milestones: data catalog deployment, stewardship program launch, policy enforcement, and metrics dashboard implementation."
  },
  {
    id: "16",
    title: "Cybersecurity Incident Response Playbook",
    type: "Playbook",
    date: "2024-09-05",
    size: "2.8 MB",
    snippet: "Comprehensive incident response playbook covering detection, analysis, containment, eradication, recovery, and lessons learned. Incident classification levels, escalation procedures.",
    content: "Comprehensive incident response playbook covering detection, analysis, containment, eradication, recovery, and lessons learned. Incident classification levels, escalation procedures, communication templates, forensic procedures, and post-incident review processes."
  },
  {
    id: "17",
    title: "Agile Project Management Framework",
    type: "Framework",
    date: "2024-03-15",
    size: "1.6 MB",
    snippet: "Enterprise agile framework combining Scrum, Kanban, and SAFe methodologies. Sprint planning templates, user story formats, retrospective guidelines.",
    content: "Enterprise agile framework combining Scrum, Kanban, and SAFe methodologies. Sprint planning templates, user story formats, retrospective guidelines, and metrics tracking (velocity, burn-down charts, cycle time). Tool recommendations: Jira, Azure DevOps, Confluence."
  },
  {
    id: "18",
    title: "Machine Learning Model Deployment Guide",
    type: "Deployment Guide",  
    date: "2024-11-12",
    size: "3.3 MB",
    snippet: "End-to-end guide for ML model deployment including containerization with Docker, orchestration with Kubernetes, CI/CD pipelines, monitoring and observability.",
    content: "End-to-end guide for ML model deployment including containerization with Docker, orchestration with Kubernetes, CI/CD pipelines, monitoring and observability, A/B testing frameworks, and model versioning strategies. MLOps best practices and tool ecosystem overview."
  },
  {
    id: "19",
    title: "Customer Data Platform Strategy",
    type: "Strategy Document",
    date: "2024-07-08",
    size: "2.2 MB",
    snippet: "Strategic framework for implementing a Customer Data Platform (CDP) including data ingestion, identity resolution, segmentation, personalization, and privacy compliance.",
    content: "Strategic framework for implementing a Customer Data Platform (CDP) including data ingestion, identity resolution, segmentation, personalization, and privacy compliance. Vendor comparison: Segment, mParticle, Adobe Experience Platform. Implementation timeline and success metrics."
  },
  {
    id: "20",
    title: "Enterprise Backup & Disaster Recovery Plan",
    type: "DR Plan",
    date: "2024-10-20",
    size: "3.6 MB",
    snippet: "Comprehensive backup and disaster recovery plan including RTO/RPO definitions, backup strategies (full, incremental, differential), recovery procedures, testing protocols.",
    content: "Comprehensive backup and disaster recovery plan including RTO/RPO definitions, backup strategies (full, incremental, differential), recovery procedures, testing protocols, and business continuity planning. Technology stack: Veeam, AWS Backup, Azure Site Recovery."
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