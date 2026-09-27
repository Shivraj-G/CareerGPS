export function FoundationPage() {
  return (
    <section className="foundation-page" aria-labelledby="foundation-title">
      <div className="foundation-card">
        <p className="eyebrow">CareerGPS</p>
        <h1 id="foundation-title">Frontend foundation is ready.</h1>
        <p>
          Routing, branding, global design tokens, responsive foundations, and
          browser-safe API configuration are in place. Feature screens are
          intentionally deferred to their approved phases.
        </p>
      </div>
    </section>
  );
}

export function RoutePlaceholderPage({ title }) {
  return (
    <section className="foundation-page" aria-labelledby="route-title">
      <div className="foundation-card">
        <p className="eyebrow">CareerGPS</p>
        <h1 id="route-title">{title}</h1>
        <p>This route is registered for the planned frontend architecture. Its feature implementation belongs to a later approved phase.</p>
      </div>
    </section>
  );
}
