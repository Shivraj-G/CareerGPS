import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Award,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  FolderGit2,
  Globe,
  FileText,
  Clock3,
  Sparkles,
  ArrowRight,
  Compass,
  Building2,
  CalendarDays
} from 'lucide-react';
import { api } from '../api/client.js';
import { formatSkillDisplayName, getSkillViewModel } from '../utils/skillDisplay.js';

export function PublicPortfolioPage() {
  const { shareSlug } = useParams();
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadPublicPortfolio() {
      setLoading(true);
      setError(null);
      try {
        const res = await api.publicPortfolio(shareSlug);
        setPortfolio(res.data);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    }

    if (shareSlug) {
      loadPublicPortfolio();
    }
  }, [shareSlug]);

  if (loading) {
    return (
      <div className="public-portfolio-container" style={{ padding: '60px 20px', textAlign: 'center' }}>
        <div className="empty-state loading-pulse">
          <Clock3 size={28} />
          <h2>Loading Career Portfolio...</h2>
        </div>
      </div>
    );
  }

  if (error || !portfolio) {
    return (
      <div className="public-portfolio-container" style={{ padding: '60px 20px', maxWidth: 600, margin: 'auto', textAlign: 'center' }}>
        <div className="empty-state">
          <ShieldCheck size={36} color="#94a3b8" />
          <h2 style={{ fontSize: 20, marginTop: 12 }}>Portfolio Unavailable</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>
            {error?.status === 404
              ? 'This portfolio either does not exist or has been made private by its author.'
              : 'Unable to load the requested portfolio at this time.'}
          </p>
          <Link to="/" className="btn primary" style={{ marginTop: 16 }}>
            Visit NaviGoa Home <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  const {
    displayName,
    targetCareer,
    headline,
    bio,
    socialLinks,
    demonstratedSkills,
    completedProjects
  } = portfolio;

  const tierBadges = {
    1: { label: 'Starter Deliverable', color: '#0284c7', bg: '#e0f2fe' },
    2: { label: 'Practical Scenario', color: '#16a34a', bg: '#dcfce7' },
    3: { label: 'Career-Ready Capstone', color: '#7c3aed', bg: '#f3e8ff' }
  };

  return (
    <div className="public-portfolio-wrapper">
      {/* Top Banner Navigation */}
      <header className="public-portfolio-header">
        <div className="public-portfolio-inner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 16, color: 'var(--ink)' }}>
            <span style={{ height: 28, width: 28, borderRadius: 8, background: 'var(--blue)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 900 }}>
              C
            </span>
            <span>NaviGoa</span>
            <span style={{ fontSize: 11, background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
              Verified Showcase
            </span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link to="/careers" className="btn outline small">
              Explore Careers
            </Link>
          </div>
        </div>
      </header>

      {/* Main Profile Showcase Hero */}
      <main className="public-portfolio-inner" style={{ padding: '40px 20px 80px' }}>
        <section className="panel" style={{ padding: '36px 32px', marginBottom: 28, background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--ink)' }}>{displayName}</h1>
                <span className="badge success" style={{ fontSize: 12, padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <ShieldCheck size={14} /> Verified Project Evidence
                </span>
              </div>

              {headline && (
                <p style={{ fontSize: 17, fontWeight: 600, color: 'var(--blue)', margin: '8px 0 0' }}>
                  {headline}
                </p>
              )}

              {targetCareer && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--muted)', marginTop: 8 }}>
                  <Compass size={16} /> Target Career Focus: <strong>{targetCareer}</strong>
                </div>
              )}

              {bio && (
                <p style={{ fontSize: 14, lineHeight: 1.6, color: '#334155', maxWidth: 760, marginTop: 16 }}>
                  {bio}
                </p>
              )}
            </div>

            {/* Social / Link Badges */}
            {socialLinks && Object.keys(socialLinks).length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {socialLinks.github && (
                  <a
                    href={socialLinks.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn outline small"
                    style={{ fontSize: 12 }}
                  >
                    <FolderGit2 size={14} /> GitHub Profile <ExternalLink size={12} />
                  </a>
                )}
                {socialLinks.linkedin && (
                  <a
                    href={socialLinks.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn outline small"
                    style={{ fontSize: 12 }}
                  >
                    <Globe size={14} /> LinkedIn Profile <ExternalLink size={12} />
                  </a>
                )}
                {socialLinks.website && (
                  <a
                    href={socialLinks.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn outline small"
                    style={{ fontSize: 12 }}
                  >
                    <Globe size={14} /> Portfolio Site <ExternalLink size={12} />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Demonstrated Skills Chips */}
          {demonstratedSkills && demonstratedSkills.length > 0 && (
            <div style={{ marginTop: 28, paddingTop: 24, borderTop: '1px solid var(--line)' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                Skills Demonstrated Through Project Deliverables
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {demonstratedSkills.map((skill, idx) => {
                  const skillVm = getSkillViewModel(skill, idx);
                  return (
                    <span
                      key={skillVm.id || idx}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        background: '#f1f5f9',
                        color: '#0f172a',
                        fontSize: 12,
                        fontWeight: 600,
                        padding: '5px 12px',
                        borderRadius: 99
                      }}
                      title={skillVm.level ? `${skillVm.name} (${skillVm.level})` : skillVm.name}
                    >
                      <CheckCircle2 size={14} color="#16a34a" />
                      {skillVm.name}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Completed Projects Showcase Section */}
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20 }}>
            <div>
              <div className="section-kicker">SHOWCASE WORK</div>
              <h2 style={{ fontSize: 24, fontWeight: 800 }}>Demonstrated Projects & Deliverables</h2>
            </div>
            <span className="muted" style={{ fontSize: 13 }}>
              {completedProjects?.length || 0} practical deliverables verified
            </span>
          </div>

          <div style={{ display: 'grid', gap: 24 }}>
            {completedProjects && completedProjects.length > 0 ? (
              completedProjects.map((project, idx) => {
                const tier = tierBadges[project.tier] || tierBadges[1];
                return (
                  <div key={idx} className="panel" style={{ padding: 28, position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: 4,
                              color: tier.color,
                              background: tier.bg
                            }}
                          >
                            {tier.label}
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                            {project.career_title}
                          </span>
                        </div>
                        <h3 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: 'var(--ink)' }}>
                          {project.title}
                        </h3>
                      </div>
                    </div>

                    <p style={{ fontSize: 14, lineHeight: 1.6, color: '#334155', margin: '0 0 16px' }}>
                      {project.brief || project.description}
                    </p>

                    {project.problem_statement && (
                      <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 8, marginBottom: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                          Problem Addressed
                        </div>
                        <div style={{ fontSize: 13, color: '#1e293b', lineHeight: 1.5 }}>
                          {project.problem_statement}
                        </div>
                      </div>
                    )}

                    {/* Deliverables List */}
                    {project.deliverables && project.deliverables.length > 0 && (
                      <div style={{ marginTop: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                          Deliverables & Proof of Work
                        </div>
                        <div style={{ display: 'grid', gap: 8 }}>
                          {project.deliverables.map((del, dIdx) => (
                            <div
                              key={dIdx}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: '#ffffff',
                                border: '1px solid var(--line)',
                                padding: '10px 14px',
                                borderRadius: 8
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                {del.deliverable_type === 'github_repo' ? (
                                  <FolderGit2 size={16} color="#2563eb" />
                                ) : del.deliverable_type === 'live_demo' ? (
                                  <Globe size={16} color="#16a34a" />
                                ) : (
                                  <FileText size={16} color="#7c3aed" />
                                )}
                                <div>
                                  <strong style={{ fontSize: 13 }}>{del.title}</strong>
                                  {del.notes && <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 8 }}>— {del.notes}</span>}
                                </div>
                              </div>
                              {del.link_url && (
                                <a
                                  href={del.link_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn outline small"
                                  style={{ fontSize: 12, padding: '4px 10px' }}
                                >
                                  View Deliverable <ExternalLink size={12} />
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Reflection / Lessons Learned */}
                    {project.reflection && (
                      <div style={{ marginTop: 18, borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                          Author Reflection & Problem Solving
                        </div>
                        <div style={{ display: 'grid', gap: 8, fontSize: 13, color: '#475569' }}>
                          {project.reflection.whatLearned && (
                            <div>
                              <strong>Key Takeaways:</strong> {project.reflection.whatLearned}
                            </div>
                          )}
                          {project.reflection.difficulties && (
                            <div>
                              <strong>Challenges Solved:</strong> {project.reflection.difficulties}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="empty-state">
                <FolderGit2 size={28} />
                <h2>No completed projects displayed</h2>
                <p>The author has not yet selected completed projects for this showcase.</p>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--line)', background: '#fff', padding: '24px 20px', textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>
        <p style={{ margin: 0 }}>
          Verified project showcase powered by <strong>NaviGoa</strong>. Project deliverables reflect demonstrable candidate work.
        </p>
      </footer>
    </div>
  );
}
