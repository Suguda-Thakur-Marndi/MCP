"use client";

import React, { use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  Layers,
  Shield,
  Key,
  Lock,
  Wrench,
  Activity,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Sliders,
  Check,
  Server,
} from "lucide-react";
import { INTEGRATIONS, Integration, IntegrationTool } from "@/lib/sentinel-data";
import { RiskBadge } from "@/components/ui/Badges";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function IntegrationDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const integrationId = resolvedParams.id;

  const integration: Integration | undefined =
    INTEGRATIONS.find((i) => i.id === integrationId) || INTEGRATIONS[0];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="pb-5 border-b border-[var(--border)] flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-mono-tnum uppercase tracking-wider text-[var(--text-muted)] mb-1">
            <Link href="/integrations" className="hover:text-[var(--text-primary)] flex items-center gap-1">
              <ChevronLeft className="w-3 h-3" />
              <span>INTEGRATIONS</span>
            </Link>
            <span>/</span>
            <span className="font-bold text-[var(--text-primary)] uppercase">{integration.name}</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-2xl">{integration.logo}</span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                  {integration.name}
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-[var(--risk-low-bg)] border border-[var(--risk-low-border)] text-[10px] font-mono-tnum font-bold text-[var(--risk-low)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--risk-low)]" />
                  {integration.status}
                </span>
                <span className="px-2 py-0.5 rounded-xs bg-[var(--bg-secondary)] border border-[var(--border)] text-[10px] font-mono-tnum text-[var(--text-secondary)]">
                  {integration.authType}
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                {integration.description}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono-tnum text-xs">
          <Link
            href="/policies"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xs border border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--text-muted)] shadow-2xs"
          >
            <Sliders className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>Manage Policies</span>
          </Link>
        </div>
      </div>

      {/* Structured Status Grid: Connection, Authentication, Permissions, Policy */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono-tnum text-xs">
        {/* Connection */}
        <div className="p-4 rounded-xs border border-[var(--border)] bg-[var(--bg-card)] shadow-2xs space-y-2">
          <div className="flex items-center gap-2 pb-2 border-b border-[var(--border-subtle)] text-[10px] uppercase font-bold text-[var(--text-muted)]">
            <Server className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>Connection</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Status:</span>
              <span className="font-bold text-[var(--risk-low)]">{integration.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Endpoint:</span>
              <span className="font-semibold text-[var(--text-primary)] truncate max-w-[160px]">
                {integration.connectionEndpoint}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Last Activity:</span>
              <span className="text-[var(--text-primary)]">{integration.lastActivity}</span>
            </div>
          </div>
        </div>

        {/* Authentication */}
        <div className="p-4 rounded-xs border border-[var(--border)] bg-[var(--bg-card)] shadow-2xs space-y-2">
          <div className="flex items-center gap-2 pb-2 border-b border-[var(--border-subtle)] text-[10px] uppercase font-bold text-[var(--text-muted)]">
            <Key className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>Authentication</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Protocol:</span>
              <span className="font-bold text-[var(--text-primary)]">{integration.authType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Token Status:</span>
              <span className="font-semibold text-[var(--risk-low)]">VALID & ROTATING</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Mutual TLS:</span>
              <span className="text-[var(--text-primary)]">Enforced</span>
            </div>
          </div>
        </div>

        {/* Security Policy */}
        <div className="p-4 rounded-xs border border-[var(--border)] bg-[var(--bg-card)] shadow-2xs space-y-2">
          <div className="flex items-center gap-2 pb-2 border-b border-[var(--border-subtle)] text-[10px] uppercase font-bold text-[var(--text-muted)]">
            <Shield className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>Security Policy</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Base Risk:</span>
              <RiskBadge level={integration.riskLevel} />
            </div>
            <div className="text-[11px] text-[var(--text-primary)] font-semibold truncate pt-1">
              {integration.activePolicies[0]}
            </div>
          </div>
        </div>
      </div>

      {/* Permissions Section */}
      <div className="p-4 sm:p-5 rounded-xs border border-[var(--border)] bg-[var(--bg-card)] shadow-2xs space-y-3">
        <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider pb-2 border-b border-[var(--border-subtle)]">
          Granted OAuth Scopes & Permissions
        </h3>
        <div className="flex flex-wrap gap-2">
          {integration.permissions.map((perm) => (
            <div
              key={perm}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xs bg-[var(--bg-secondary)] border border-[var(--border)] font-mono-tnum text-xs text-[var(--text-primary)]"
            >
              <Check className="w-3 h-3 text-[var(--risk-low)]" />
              <span>{perm}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tools Section */}
      <div className="rounded-xs border border-[var(--border)] bg-[var(--bg-card)] shadow-2xs space-y-4 p-4 sm:p-5">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
          <div>
            <span className="text-[10px] font-mono-tnum uppercase tracking-wider text-[var(--text-muted)] block">
              Registered Tool Contracts
            </span>
            <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-[var(--accent)]" />
              Available Tools ({integration.tools.length})
            </h3>
          </div>
          <span className="text-[10px] font-mono-tnum text-[var(--text-muted)]">
            Enforced by Pydantic V2 Schema Validation
          </span>
        </div>

        <div className="space-y-3">
          {integration.tools.map((tool) => (
            <div
              key={tool.id}
              className="p-4 rounded-xs border border-[var(--border)] bg-[var(--bg-secondary)]/30 space-y-2 hover:border-[var(--text-muted)] transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <code className="text-xs font-bold font-mono-tnum text-[var(--accent)]">
                    {tool.name}
                  </code>
                  <RiskBadge level={tool.riskLevel} score={tool.riskScore} />
                  {tool.requiresApproval && (
                    <span className="px-1.5 py-0.2 rounded-xs bg-[var(--risk-critical-bg)] border border-[var(--risk-critical-border)] text-[9px] font-mono-tnum font-bold text-[var(--risk-critical)]">
                      APPROVAL REQUIRED
                    </span>
                  )}
                  {tool.isDestructive && (
                    <span className="px-1.5 py-0.2 rounded-xs bg-[var(--risk-critical-bg)] border border-[var(--risk-critical-border)] text-[9px] font-mono-tnum font-bold text-[var(--risk-critical)]">
                      DESTRUCTIVE
                    </span>
                  )}
                </div>

                <span className="text-[10px] font-mono-tnum text-[var(--text-muted)]">
                  {tool.recentExecutionsCount.toLocaleString()} total calls
                </span>
              </div>

              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                {tool.description}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-[var(--border-subtle)] text-[11px] font-mono-tnum">
                <div>
                  <span className="text-[var(--text-muted)]">Allowed Resources: </span>
                  <span className="text-[var(--text-primary)] font-semibold">{tool.allowedResources.join(", ")}</span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)]">Active Policy: </span>
                  <span className="text-[var(--text-primary)] font-semibold">{tool.policy}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
