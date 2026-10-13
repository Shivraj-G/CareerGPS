const fs = require('fs');

const replacement = `                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase' }}>COMPATIBILITY STATUS</div>

                  <div style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 12,
                    fontSize: 13,
                    fontWeight: 600,
                    border: \`1px solid \${validationData.direct_route_status === 'D' ? 'var(--red)' : ['B', 'C'].includes(validationData.direct_route_status) ? '#eab308' : validationData.direct_route_status === 'A' ? 'var(--green)' : 'var(--text-muted)'}\`,
                    background: validationData.direct_route_status === 'D' ? 'rgba(255,0,0,0.05)' : ['B', 'C'].includes(validationData.direct_route_status) ? 'rgba(234,179,8,0.05)' : validationData.direct_route_status === 'A' ? 'rgba(0,128,0,0.05)' : 'rgba(0,0,0,0.05)',
                    color: validationData.direct_route_status === 'D' ? 'var(--red)' : ['B', 'C'].includes(validationData.direct_route_status) ? '#ca8a04' : validationData.direct_route_status === 'A' ? 'var(--green)' : 'var(--text-muted)'
                  }}>
                  {validationData.direct_route_status === 'E' ? <><HelpCircle size={16} /> Verification Required</> :
                      validationData.direct_route_status === 'D' ? <><XCircle size={16} /> Blocked/Ineligible</> :
                        ['B', 'C'].includes(validationData.direct_route_status) ? <><CheckCircle size={16} /> Alternative route available</> :
                          <><CheckCircle size={16} /> Highly aligned</>}
                  </div>

                  <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>
                    <p style={{ margin: '0 0 12px 0' }}>{validationData.reason || "We are reviewing your compatibility."}</p>
                    
                    {validationData.missing_requirements?.length > 0 && (
                      <div>
                        <strong style={{ fontSize: 13, fontWeight: 600 }}>Action Plan:</strong>
                        <ul style={{ margin: '6px 0 12px 0', paddingLeft: 20, color: 'var(--text-muted)' }}>
                          {validationData.missing_requirements.map((req, idx) => <li style={{ marginBottom: 4 }} key={\`req-\${idx}\`}>{req}</li>)}
                        </ul>
                      </div>
                    )}
                    
                    {validationData.skill_gaps?.length > 0 && (
                      <div>
                        <strong style={{ fontSize: 13, fontWeight: 600 }}>Suggested Skill Milestones:</strong>
                        <ul style={{ margin: '6px 0 12px 0', paddingLeft: 20, color: 'var(--text-muted)' }}>
                          {validationData.skill_gaps.map((gap, idx) => <li style={{ marginBottom: 4 }} key={\`gap-\${idx}\`}>{gap}</li>)}
                        </ul>
                      </div>
                    )}
                    
                    {validationData.formal_barriers?.length > 0 && (
                      <div>
                        <strong style={{ fontSize: 13, fontWeight: 600 }}>Important Requirements:</strong>
                        <ul style={{ margin: '6px 0 12px 0', paddingLeft: 20, color: 'var(--text-muted)' }}>
                          {validationData.formal_barriers.map((bar, idx) => <li style={{ marginBottom: 4 }} key={\`bar-\${idx}\`}>{bar}</li>)}
                        </ul>
                      </div>
                    )}
                    
                    {validationData.ai_generated && validationData.direct_route_status === 'E' && (
                      <p style={{ margin: '12px 0 0 0', fontSize: 12, color: '#eab308' }}>
                        * This is an AI-suggested pathway and may require formal verification.
                      </p>
                    )}
                  </div>`;

function patchFile(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');
  const startIndex = code.indexOf("<div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase' }}>COMPATIBILITY STATUS</div>");
  const endSearchStr = "We couldn't find this career in the CareerGPS career catalogue.</p>\n                    )}\n                  </div>";
  const endSearchStrR = "We couldn't find this career in the CareerGPS career catalogue.</p>\r\n                    )}\r\n                  </div>";
  
  let endIndex = code.indexOf(endSearchStr, startIndex);
  if (endIndex === -1) endIndex = code.indexOf(endSearchStrR, startIndex);

  if (startIndex !== -1 && endIndex !== -1) {
    code = code.substring(0, startIndex) + replacement + code.substring(endIndex + (endIndex === code.indexOf(endSearchStrR, startIndex) ? endSearchStrR.length : endSearchStr.length));
    fs.writeFileSync(filePath, code);
    console.log("Updated", filePath);
  } else {
    console.log("Failed to patch", filePath);
  }
}

patchFile('frontend/src/pages/LegacyPages.jsx');
patchFile('frontend/src/main.jsx');
