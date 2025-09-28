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
  // Marketing Campaign Briefs
  {
    id: "1",
    title: "Q4 2024 Holiday Campaign Brief",
    type: "Marketing Brief",
    date: "2024-03-20",
    size: "1.2 MB",
    snippet: "Comprehensive holiday marketing strategy targeting 25% increase in seasonal sales. Multi-channel approach across digital, social, and traditional media...",
    content: "Executive Summary: Q4 Holiday Campaign targeting premium gift market with $2.5M budget allocation..."
  },
  {
    id: "2", 
    title: "Brand Refresh Campaign - Creative Direction",
    type: "Creative Brief",
    date: "2024-03-18",
    size: "3.1 MB",
    snippet: "Complete brand identity overhaul including logo redesign, color palette evolution, and typography system. Focus on modern, sustainable values...",
    content: "Brand positioning strategy emphasizing sustainability and innovation..."
  },
  
  // Client RFP Drafts
  {
    id: "3",
    title: "Acme Corp - Integrated Marketing RFP",
    type: "RFP Draft",
    date: "2024-03-16",
    size: "2.8 MB", 
    snippet: "Full-service marketing partnership proposal for Acme Corp's product launch. $800K budget, 12-month campaign timeline, digital-first approach...",
    content: "Project Overview: Acme Corp seeks integrated marketing partner for Q2 product launch..."
  },
  {
    id: "4",
    title: "TechStart Influencer Campaign RFP",
    type: "RFP Draft", 
    date: "2024-03-14",
    size: "1.9 MB",
    snippet: "Influencer marketing strategy for B2B SaaS startup. Target: 500K qualified leads, focus on LinkedIn and YouTube thought leaders...",
    content: "Campaign Objectives: Generate 500K qualified B2B leads through strategic influencer partnerships..."
  },

  // Creative Pitch Decks
  {
    id: "5", 
    title: "Nike Partnership - Creative Pitch Deck",
    type: "Presentation",
    date: "2024-03-12",
    size: "15.4 MB",
    snippet: "Award-winning creative concept for Nike's sustainability initiative. 360-degree campaign leveraging AR, social activism, and athlete partnerships...",
    content: "Slide 1: The Challenge - Connecting Nike's sustainability mission with Gen Z consumers..."
  },
  {
    id: "6",
    title: "Apple Store Experience - UX Pitch",
    type: "Presentation", 
    date: "2024-03-10",
    size: "22.1 MB",
    snippet: "Revolutionary in-store experience design combining digital and physical touchpoints. Focus on seamless customer journey and premium service...",
    content: "Executive Summary: Reimagining Apple Store experience for the digital-first generation..."
  },

  // Performance Reports
  {
    id: "7",
    title: "Meta Ads Performance - February 2024",
    type: "Analytics Report",
    date: "2024-03-01", 
    size: "5.2 MB",
    snippet: "February campaign performance across Facebook and Instagram. 340% ROAS, 2.1M impressions, 45K conversions. Video content outperformed static by 180%...",
    content: "Campaign Performance Summary: February 2024 Meta campaigns exceeded targets by 40%..."
  },
  {
    id: "8", 
    title: "Google Ads Optimization Report",
    type: "Analytics Report",
    date: "2024-02-28",
    size: "3.7 MB", 
    snippet: "Search and display campaign analysis with recommendations. CPC reduced 23%, conversion rate improved 31% through smart bidding and audience refinement...",
    content: "Optimization Results: Smart bidding implementation resulted in 31% conversion improvement..."
  },

  // Brand Guidelines & Assets
  {
    id: "9",
    title: "Global Brand Guidelines v3.2",
    type: "Brand Guide",
    date: "2024-03-22",
    size: "28.9 MB",
    snippet: "Complete brand system including logo usage, color specifications, typography, photography style, and voice guidelines. 150+ pages of comprehensive standards...",
    content: "Brand Identity System: Our brand reflects innovation, sustainability, and human-centered design..."
  },
  {
    id: "10",
    title: "Video Asset Library - Q1 2024", 
    type: "Media Library",
    date: "2024-03-25",
    size: "1.2 GB",
    snippet: "Curated collection of 200+ video assets: product demos, testimonials, behind-the-scenes content. All formats optimized for social platforms...",
    content: "Video Content Inventory: Q1 2024 - 247 video assets across 15 campaign themes..."
  },

  // Creative Campaigns
  {
    id: "11",
    title: "SuperBowl 2024 - Campaign Retrospective",
    type: "Case Study",
    date: "2024-02-15",
    size: "4.1 MB",
    snippet: "Post-campaign analysis of SuperBowl commercial performance. 45M+ organic impressions, 2.3M social engagements, brand recall increased 67%...",
    content: "Campaign Success Metrics: SuperBowl commercial generated 45M organic impressions..."
  },
  {
    id: "12", 
    title: "Sustainability Campaign - Earth Day 2024",
    type: "Campaign Plan",
    date: "2024-03-05",
    size: "6.3 MB",
    snippet: "Earth Day activation strategy combining influencer partnerships, user-generated content, and carbon offset initiatives. Target: 10M reach, 500K engagements...",
    content: "Earth Day Campaign Strategy: Authentic sustainability storytelling through community activation..."
  },

  // Client Presentations
  {
    id: "13",
    title: "Quarterly Business Review - Q1 2024", 
    type: "Client Presentation",
    date: "2024-03-28",
    size: "8.7 MB",
    snippet: "Comprehensive Q1 performance review with strategic recommendations for Q2. Revenue growth 23%, customer acquisition cost reduced 18%...",
    content: "Q1 Performance Highlights: Exceeded growth targets by 23% through optimized acquisition strategies..."
  },
  {
    id: "14",
    title: "2024 Marketing Strategy Presentation",
    type: "Strategy Deck", 
    date: "2024-01-15",
    size: "12.4 MB",
    snippet: "Annual marketing strategy focusing on digital transformation, customer experience, and data-driven personalization. Budget allocation across 8 key channels...",
    content: "2024 Strategic Priorities: Digital-first approach with emphasis on personalization and customer experience..."
  },

  // Competitive Analysis
  {
    id: "15",
    title: "Competitive Landscape Analysis - March 2024",
    type: "Market Research",
    date: "2024-03-20",
    size: "7.8 MB", 
    snippet: "In-depth analysis of top 10 competitors including messaging, pricing, campaign strategies, and market positioning. Key insights for differentiation...",
    content: "Market Positioning Analysis: Competitive landscape shows opportunity for premium positioning..."
  },
  {
    id: "16",
    title: "Social Media Benchmarking Report",
    type: "Benchmark Report",
    date: "2024-03-18",
    size: "3.2 MB",
    snippet: "Social media performance vs. industry benchmarks across all platforms. Engagement rates 40% above average, follower growth rate leading category...",
    content: "Social Performance Benchmarks: Engagement rates consistently 40% above industry average..."
  },

  // Creative Assets
  {
    id: "17", 
    title: "Photography Style Guide - Spring 2024",
    type: "Creative Guide",
    date: "2024-03-10",
    size: "45.2 MB",
    snippet: "Visual guidelines for spring campaign photography including lighting, composition, color grading, and model direction. 100+ reference images...",
    content: "Photography Direction: Spring 2024 aesthetic emphasizes natural lighting and authentic moments..."
  },
  {
    id: "18",
    title: "Influencer Content Library",
    type: "Content Archive", 
    date: "2024-03-15",
    size: "2.1 GB",
    snippet: "Archived influencer-generated content from 50+ partnerships. High-performing posts, stories, and reels organized by campaign and platform...",
    content: "Influencer Content Performance: Top-performing creators generated 15M+ impressions..."
  },

  // Campaign Results
  {
    id: "19",
    title: "Holiday 2023 - Final Performance Report",
    type: "Campaign Results", 
    date: "2024-01-10",
    size: "9.1 MB",
    snippet: "Complete holiday campaign analysis: $5.2M revenue generated, 180% return on ad spend, 2.3M new customers acquired across all channels...",
    content: "Holiday Campaign Success: Generated $5.2M revenue with 180% ROAS across integrated channels..."
  },
  {
    id: "20",
    title: "Email Marketing Performance - Q1 2024",
    type: "Email Analytics",
    date: "2024-03-30",
    size: "2.6 MB", 
    snippet: "Email campaign performance metrics: 34% open rate, 8.2% CTR, 12% conversion rate. Segmented campaigns outperformed broadcast by 290%...",
    content: "Email Performance Analysis: Segmented campaigns achieved 290% higher performance than broadcast..."
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