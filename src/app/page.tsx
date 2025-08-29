'use client';

import { useState, useEffect } from 'react';

interface HealthData {
  status: string;
  timestamp: string;
  version: string;
  environment: string;
  deployment: string;
  message: string;
}

export default function Home() {
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => {
        setHealthData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Health check failed:', err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🚀 Gallifrey Rainmaker
          </h1>
          <p className="text-xl text-gray-600 mb-2">
            Dual-Track Marketing Automation System
          </p>
          <p className="text-sm text-gray-500">
            AI-Powered Lead Processing with Google Sheets Frontend
          </p>
        </div>

        {/* System Status */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              📊 System Status
            </h2>
            
            {loading ? (
              <div className="animate-pulse">
                <div className="h-4 bg-gray-300 rounded w-1/4 mb-2"></div>
                <div className="h-4 bg-gray-300 rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-gray-300 rounded w-1/3"></div>
              </div>
            ) : healthData ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center">
                    <span className="font-medium text-gray-700 w-24">Status:</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      healthData.status === 'healthy' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {healthData.status}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium text-gray-700 w-24">Version:</span>
                    <span className="text-gray-600">{healthData.version}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium text-gray-700 w-24">Environment:</span>
                    <span className="text-gray-600">{healthData.environment}</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <span className="font-medium text-gray-700 w-24">Deployment:</span>
                    <span className="text-gray-600">{healthData.deployment}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium text-gray-700 w-24">Updated:</span>
                    <span className="text-gray-600 text-sm">
                      {new Date(healthData.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-red-600">
                ⚠️ Unable to load system status
              </div>
            )}
          </div>

          {/* Features Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <FeatureCard
              icon="🎯"
              title="Dual-Track Strategy"
              description="Enterprise B2B and SMB tracks with specialized AI agents"
            />
            <FeatureCard
              icon="🤖"
              title="AI Agents"
              description="6 specialized agents for research, content, and conversion"
            />
            <FeatureCard
              icon="📊"
              title="Google Sheets"
              description="Familiar spreadsheet interface with real-time sync"
            />
            <FeatureCard
              icon="⚡"
              title="Serverless"
              description="Optimized for Vercel and modern cloud deployment"
            />
            <FeatureCard
              icon="🔄"
              title="Real-time Sync"
              description="Live updates between sheets and backend systems"
            />
            <FeatureCard
              icon="📈"
              title="Analytics"
              description="Performance tracking and conversion optimization"
            />
          </div>

          {/* API Endpoints */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              🔗 API Endpoints
            </h2>
            <div className="space-y-3">
              <APIEndpoint method="GET" path="/api/health" description="System health check" />
              <APIEndpoint method="GET" path="/api/sheets/enterprise-data" description="Enterprise pipeline data" />
              <APIEndpoint method="GET" path="/api/sheets/smb-data" description="SMB pipeline data" />
              <APIEndpoint method="POST" path="/api/sheets/lead-intake" description="Process new leads" />
              <APIEndpoint method="GET" path="/api/agents/status" description="AI agent status" />
            </div>
          </div>

          {/* Quick Start */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              🚀 Quick Start
            </h2>
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3 mt-0.5">
                  1
                </div>
                <div>
                  <p className="font-medium">Set up your database</p>
                  <p className="text-gray-600 text-sm">Configure PostgreSQL (Vercel Postgres recommended)</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3 mt-0.5">
                  2
                </div>
                <div>
                  <p className="font-medium">Configure environment variables</p>
                  <p className="text-gray-600 text-sm">Add OpenAI API key and Google Service Account</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3 mt-0.5">
                  3
                </div>
                <div>
                  <p className="font-medium">Run database migrations</p>
                  <p className="text-gray-600 text-sm">Execute: <code className="bg-gray-100 px-2 py-1 rounded">npm run db:migrate</code></p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3 mt-0.5">
                  4
                </div>
                <div>
                  <p className="font-medium">Deploy Google Sheets integration</p>
                  <p className="text-gray-600 text-sm">Run setup script and deploy Apps Script</p>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t">
              <p className="text-sm text-gray-500">
                📖 For detailed setup instructions, see <code>DEPLOYMENT.md</code> and <code>GETTING_STARTED.md</code>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-800 mb-2">{title}</h3>
      <p className="text-gray-600 text-sm">{description}</p>
    </div>
  );
}

function APIEndpoint({ method, path, description }: { method: string; path: string; description: string }) {
  return (
    <div className="flex items-center space-x-4 p-3 bg-gray-50 rounded-md">
      <span className={`px-2 py-1 text-xs font-bold rounded ${
        method === 'GET' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
      }`}>
        {method}
      </span>
      <code className="font-mono text-sm text-gray-700 flex-1">{path}</code>
      <span className="text-sm text-gray-600">{description}</span>
    </div>
  );
}