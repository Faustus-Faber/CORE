export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-canvas py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-ink mb-6">Privacy and Data Policy</h1>
        
        <section className="bg-panel-white rounded-lg p-6 shadow-panel mb-6">
          <h2 className="text-xl font-semibold text-ink mb-3">Our principles</h2>
          <p className="text-sm text-muted mb-4">
            CORE follows the OCHA Principles of Humanitarian Information Management:
            accountability, verifiability, objectivity, confidentiality, and timeliness.
          </p>
        </section>

        <section className="bg-panel-white rounded-lg p-6 shadow-panel mb-6">
          <h2 className="text-xl font-semibold text-ink mb-3">Data classification</h2>
          <ul className="space-y-2 text-sm text-muted">
            <li><strong className="text-ink">Public:</strong> Redacted verified crisis summary and approved warnings.</li>
            <li><strong className="text-ink">Internal:</strong> Operational status, approximate resource/responder data.</li>
            <li><strong className="text-ink">Confidential:</strong> Exact location, contact details, private evidence.</li>
            <li><strong className="text-ink">Strictly confidential:</strong> Vulnerable-person data, identity documents, sensitive medical evidence.</li>
          </ul>
        </section>

        <section className="bg-panel-white rounded-lg p-6 shadow-panel mb-6">
          <h2 className="text-xl font-semibold text-ink mb-3">Location privacy</h2>
          <p className="text-sm text-muted">
            Location collection is optional and consented. Exact personal coordinates
            are never shared publicly — only approximate areas. You can refresh or
            delete your precise location at any time.
          </p>
        </section>

        <section className="bg-panel-white rounded-lg p-6 shadow-panel mb-6">
          <h2 className="text-xl font-semibold text-ink mb-3">Third-party AI processing</h2>
          <p className="text-sm text-muted">
            Voice transcription, translation, and image OCR may use third-party AI
            providers. Consent is required before sending sensitive images to
            external services. You will always be informed before processing.
          </p>
        </section>

        <section className="bg-panel-white rounded-lg p-6 shadow-panel mb-6">
          <h2 className="text-xl font-semibold text-ink mb-3">Evidence retention</h2>
          <p className="text-sm text-muted">
            Evidence is retained according to its classification and the crisis
            lifecycle. Rejected signals, expired share packages, and deleted assets
            are removed according to policy. Audit records are retained for
            accountability.
          </p>
        </section>

        <section className="bg-panel-white rounded-lg p-6 shadow-panel">
          <h2 className="text-xl font-semibold text-ink mb-3">Contact</h2>
          <p className="text-sm text-muted">
            For privacy concerns or data requests, contact your organization
            administrator or the CORE deployment operator.
          </p>
        </section>
      </div>
    </div>
  );
}
