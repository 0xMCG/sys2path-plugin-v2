import type { Entity, GraphData, Message, Motivation, Project, UserProfile, DataSource, HistoryItem } from '../types';

export const currentUser: UserProfile = {
  name: "Alex Dev",
  email: "alex@example.com",
  plan: "Free",
  tokensUsed: 12450,
  tokenLimit: 50000,
  nodeCount: 84
};

export const motivations: Motivation[] = [
  { id: 'study', icon: '🎓', label: 'Study', description: 'Extract concepts & build path', prompt: 'Analyze the following conversation for educational concepts...' },
  { id: 'understand', icon: '💡', label: 'Understand', description: 'Explain terms & context', prompt: 'Explain the complex terms in this context...' },
  { id: 'reason', icon: '🧠', label: 'Reason', description: 'Analyze logic & fallacies', prompt: 'Critique the logic and find potential contradictions...' },
  { id: 'design', icon: '🎨', label: 'Design', description: 'Extract patterns & arch', prompt: 'Extract architecture patterns from this discussion...' },
  { id: 'summarize', icon: '📝', label: 'Summarize', description: 'Key takeaways', prompt: 'Summarize the key points...' },
  { id: 'review', icon: '🔄', label: 'Review', description: 'Decisions & open items', prompt: 'Review the decision making process...' },
];

export const mockProjects: Project[] = [
  { id: 'p1', name: 'Microservices Study', sourceCount: 12, lastActive: '2 mins ago' },
  { id: 'p2', name: 'React Performance', sourceCount: 5, lastActive: '1 day ago' },
];

export const mockDataSources: DataSource[] = [
  {
    id: 'ds1',
    title: 'Microservices Patterns - Chat',
    url: 'https://chatgpt.com/c/conversation-101',
    type: 'web',
    platform: 'demo',
    isUploaded: true,
    lastSaved: '10 mins ago',
    ckgStatus: 'generated',
    relevanceScore: 0.98,
    currentVersionId: 'v2',
    versions: [
      { id: 'v2', timestamp: 'Today, 10:42 AM', changeSummary: 'Added Sidecar discussion', tag: 'Final Review' },
      { id: 'v1', timestamp: 'Today, 09:15 AM', changeSummary: 'Initial capture' }
    ]
  },
  {
    id: 'ds2',
    title: 'Kubernetes Docs - Services',
    url: 'https://kubernetes.io/docs/concepts/services-networking/service/',
    type: 'web',
    platform: 'demo',
    isUploaded: true,
    lastSaved: '2 days ago',
    ckgStatus: 'generated',
    relevanceScore: 0.85,
    currentVersionId: 'v1',
    versions: [
      { id: 'v1', timestamp: 'Oct 24, 2:00 PM', changeSummary: 'Full page capture', tag: 'Docs' }
    ]
  },
  {
    id: 'ds3',
    title: 'System Design PDF',
    url: 'local://files/sys-design.pdf',
    type: 'upload',
    platform: 'demo',
    isUploaded: false,
    lastSaved: '1 week ago',
    ckgStatus: 'pending',
    relevanceScore: 0.45,
    currentVersionId: 'v1',
    versions: [
      { id: 'v1', timestamp: 'Oct 15, 11:00 AM', changeSummary: 'Uploaded' }
    ]
  }
];

export const mockHistory: HistoryItem[] = [
  { id: 'h1', summary: 'Microservices & Sidecars', timestamp: '10 mins ago', messageCount: 4, preview: 'Defined Service Mesh vs API Gateway...' },
  { id: 'h2', summary: 'React useEffect Debugging', timestamp: 'Yesterday', messageCount: 12, preview: 'Analyzed dependency array issues...' },
  { id: 'h3', summary: 'Q3 Financial Report Analysis', timestamp: '3 days ago', messageCount: 8, preview: 'Extracted key revenue growth tables...' },
];

export const mockEntities: Record<string, Entity> = {
  'API Gateway': {
    id: 'API Gateway',
    name: 'API Gateway',
    type: 'Infrastructure',
    rank: 0.95,
    summary: 'An API gateway is an API management tool that sits between a client and a collection of backend services.',
    relatedChunks: [
      'The [API Gateway] acts as a single entry point for all clients.',
      'It handles cross-cutting concerns like authentication, SSL termination, and rate limiting.'
    ]
  },
  'Service Mesh': {
    id: 'Service Mesh',
    name: 'Service Mesh',
    type: 'Infrastructure',
    rank: 0.88,
    summary: 'A service mesh is a dedicated infrastructure layer for facilitating service-to-service communications.',
    relatedChunks: [
      'While an [API Gateway] handles north-south traffic, a [Service Mesh] handles east-west traffic.',
      'Istio is a popular example of a [Service Mesh].'
    ]
  },
  'Sidecar': {
    id: 'Sidecar',
    name: 'Sidecar',
    type: 'Pattern',
    rank: 0.75,
    summary: 'The sidecar pattern involves deploying a helper component of an application as a separate container or process.',
    relatedChunks: [
      'In a [Service Mesh], the data plane is often implemented as a [Sidecar] proxy.',
      'This allows the [Sidecar] to abstract network complexity from the application logic.'
    ]
  }
};

export const mockGraphData: GraphData = {
  nodes: [
    { id: 'API Gateway', group: 1, rank: 0.95 },
    { id: 'Service Mesh', group: 1, rank: 0.88 },
    { id: 'Sidecar', group: 2, rank: 0.75 },
    { id: 'Microservices', group: 1, rank: 0.99 },
    { id: 'Kubernetes', group: 3, rank: 0.80 },
    { id: 'Netflix Zuul', group: 2, rank: 0.60 },
  ],
  links: [
    { source: 'API Gateway', target: 'Microservices', value: 5, summary: 'Gateway exposes Microservices endpoints' },
    { source: 'Service Mesh', target: 'Microservices', value: 5, summary: 'Mesh connects Microservices internally' },
    { source: 'Sidecar', target: 'Service Mesh', value: 8, summary: 'Sidecar implements Mesh data plane' },
    { source: 'API Gateway', target: 'Netflix Zuul', value: 3, summary: 'Zuul is an implementation of API Gateway' },
    { source: 'Service Mesh', target: 'Kubernetes', value: 4, summary: 'Mesh runs on top of Kubernetes' },
  ]
};

// Simulate AI Response with "Smart Indices" formatted as [EntityName]
export const generateMockResponse = (prompt: string): Message => {
  return {
    id: Date.now().toString(),
    role: 'ai',
    timestamp: Date.now(),
    content: `Based on your request to **${prompt}**, here is an analysis of the architecture:

The system relies heavily on an [API Gateway] to manage incoming traffic. This is crucial for security and protocol translation.

Internally, the team is adopting a [Service Mesh] to manage complex service-to-service communication. This often utilizes the [Sidecar] pattern to inject proxies without modifying application code.

Key takeaways:
1. [API Gateway] for Edge traffic.
2. [Service Mesh] for internal reliability.
3. [Sidecar] for decoupling network logic.`,
    entities: ['API Gateway', 'Service Mesh', 'Sidecar']
  };
};

