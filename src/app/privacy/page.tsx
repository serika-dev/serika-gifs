import { Header } from '@/components/header'
import Link from 'next/link'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://gifs.serika.dev'

export const metadata = {
  title: 'Privacy Policy - SerikaGIFs',
  description: 'Privacy Policy for SerikaGIFs - GDPR compliant data handling, user privacy information, and cookie policy.',
  keywords: ['privacy policy', 'gdpr compliant', 'data protection', 'cookie policy', 'serikagifs'],
  alternates: {
    canonical: `${SITE_URL}/privacy`,
  },
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="text-2xl font-semibold mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: January 29, 2026</p>

        <div className="prose prose-zinc max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-4">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              SerikaGifs (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is committed to protecting your privacy. 
              This Privacy Policy explains how we collect, use, and protect information when you use our Service. 
              We comply with the General Data Protection Regulation (GDPR - EU 2016/679), the Dutch Implementation 
              Act GDPR (Uitvoeringswet AVG), and other applicable Dutch and EU privacy laws.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">2. Data Controller</h2>
            <p className="text-muted-foreground leading-relaxed">
              SerikaGifs acts as the data controller for the personal data processed through this Service. 
              For any privacy-related inquiries, you may contact us at{' '}
              <a href="mailto:legal@serika.dev" className="text-primary hover:underline">legal@serika.dev</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">3. Information We Collect</h2>
            <div className="text-muted-foreground leading-relaxed space-y-4">
              <div>
                <h3 className="text-lg font-medium text-foreground mb-2">3.1 Account Information</h3>
                <p>When you create an account, we collect:</p>
                <ul className="list-disc pl-6 space-y-1 mt-2">
                  <li>Username (chosen by you)</li>
                  <li>Email address</li>
                  <li>Password (stored securely using industry-standard hashing)</li>
                  <li>Profile picture (optional)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-medium text-foreground mb-2">3.2 Usage Data</h3>
                <p>We automatically collect certain information when you use our Service:</p>
                <ul className="list-disc pl-6 space-y-1 mt-2">
                  <li>IP address (for rate limiting and security)</li>
                  <li>API request logs (endpoint, timestamp, response code)</li>
                  <li>Browser type and version</li>
                  <li>Device information</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-medium text-foreground mb-2">3.3 Content Data</h3>
                <p>When you upload content, we store:</p>
                <ul className="list-disc pl-6 space-y-1 mt-2">
                  <li>The uploaded files (GIFs, videos)</li>
                  <li>Associated metadata (title, tags, descriptions)</li>
                  <li>Upload timestamp and source information</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">4. Legal Basis for Processing</h2>
            <div className="text-muted-foreground leading-relaxed space-y-3">
              <p>Under GDPR Article 6, we process your data based on:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Contract performance (Art. 6(1)(b)):</strong> Processing necessary to provide the Service you requested</li>
                <li><strong>Legitimate interests (Art. 6(1)(f)):</strong> Security, fraud prevention, and service improvement</li>
                <li><strong>Legal obligations (Art. 6(1)(c)):</strong> Compliance with Dutch and EU law</li>
                <li><strong>Consent (Art. 6(1)(a)):</strong> Where explicitly provided (e.g., marketing communications)</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">5. How We Use Your Information</h2>
            <div className="text-muted-foreground leading-relaxed space-y-3">
              <p>We use collected information to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Provide, maintain, and improve the Service</li>
                <li>Authenticate users and manage accounts</li>
                <li>Enforce rate limits and prevent abuse</li>
                <li>Respond to support requests</li>
                <li>Detect and prevent fraud, security incidents, and illegal activities</li>
                <li>Comply with legal obligations</li>
                <li>Analyze usage patterns to improve our Service (aggregated, anonymized data only)</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">6. Data Retention</h2>
            <div className="text-muted-foreground leading-relaxed space-y-3">
              <p>We retain your data for the following periods:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Account data:</strong> Until account deletion, plus 30 days for backup purposes</li>
                <li><strong>Uploaded content:</strong> Until you delete it or your account is terminated</li>
                <li><strong>API logs:</strong> 90 days for operational purposes</li>
                <li><strong>Security logs:</strong> Up to 1 year for fraud prevention and legal compliance</li>
              </ul>
              <p>
                After the retention period, data is securely deleted or anonymized in accordance with 
                GDPR Article 17 (Right to Erasure).
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">7. Data Sharing</h2>
            <div className="text-muted-foreground leading-relaxed space-y-3">
              <p>We do not sell your personal data. We may share data with:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Service providers:</strong> Cloud hosting (data processing agreements in place)</li>
                <li><strong>Legal authorities:</strong> When required by Dutch or EU law, or valid legal process</li>
                <li><strong>Business transfers:</strong> In connection with merger, acquisition, or asset sale (with notice)</li>
              </ul>
              <p>
                All third-party processors are bound by GDPR-compliant data processing agreements (Art. 28 GDPR).
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">8. International Data Transfers</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your data may be processed outside the European Economic Area (EEA). When this occurs, 
              we ensure appropriate safeguards are in place, including Standard Contractual Clauses (SCCs) 
              approved by the European Commission, or adequacy decisions under GDPR Article 45. 
              Data transfers to the United States are conducted under the EU-U.S. Data Privacy Framework where applicable.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">9. Your Rights (GDPR)</h2>
            <div className="text-muted-foreground leading-relaxed space-y-3">
              <p>Under GDPR, you have the following rights:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Right of Access (Art. 15):</strong> Request a copy of your personal data</li>
                <li><strong>Right to Rectification (Art. 16):</strong> Correct inaccurate or incomplete data</li>
                <li><strong>Right to Erasure (Art. 17):</strong> Request deletion of your personal data</li>
                <li><strong>Right to Restriction (Art. 18):</strong> Limit how we process your data</li>
                <li><strong>Right to Data Portability (Art. 20):</strong> Receive your data in a structured format</li>
                <li><strong>Right to Object (Art. 21):</strong> Object to processing based on legitimate interests</li>
                <li><strong>Right to Withdraw Consent (Art. 7(3)):</strong> Withdraw consent at any time</li>
              </ul>
              <p>
                To exercise these rights, contact us through the contact information on our website. 
                We will respond within 30 days as required by GDPR Article 12.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">10. Cookies & Tracking</h2>
            <div className="text-muted-foreground leading-relaxed space-y-3">
              <p>We use essential cookies for:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Authentication:</strong> Keeping you logged in (session cookies)</li>
                <li><strong>Preferences:</strong> Remembering your settings (e.g., theme)</li>
              </ul>
              <p>
                We do not use third-party tracking cookies or analytics that track individual users. 
                Essential cookies are necessary for the Service to function and do not require consent 
                under the Dutch Telecommunications Act (Article 11.7a).
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">11. Security</h2>
            <div className="text-muted-foreground leading-relaxed space-y-3">
              <p>We implement appropriate technical and organizational measures to protect your data, including:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Encryption in transit (TLS/HTTPS)</li>
                <li>Encryption at rest for sensitive data</li>
                <li>Secure password hashing (bcrypt/argon2)</li>
                <li>Regular security assessments</li>
                <li>Access controls and authentication</li>
              </ul>
              <p>
                In case of a data breach affecting your rights, we will notify the Dutch Data Protection Authority 
                (Autoriteit Persoonsgegevens) within 72 hours and inform you without undue delay, as required by 
                GDPR Articles 33 and 34.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">12. Children&apos;s Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              Our Service is not intended for children under 16 years of age, in accordance with Dutch law 
              implementing GDPR Article 8. We do not knowingly collect personal data from children under 16. 
              If you believe we have collected such data, please contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">13. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy periodically. Material changes will be notified via the Service 
              or email at least 30 days before taking effect. The &quot;Last updated&quot; date at the top indicates 
              the most recent revision.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">14. Complaints</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you believe we have violated your privacy rights, you have the right to lodge a complaint with the 
              Dutch Data Protection Authority (Autoriteit Persoonsgegevens) at <span className="text-primary">autoriteitpersoonsgegevens.nl</span>. 
              We encourage you to contact us first so we can address your concerns.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">15. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              For privacy-related questions or to exercise your rights, please contact us at{' '}
              <a href="mailto:legal@serika.dev" className="text-primary hover:underline">legal@serika.dev</a>.
            </p>
          </section>

          <div className="border-t border-border pt-8 mt-12">
            <p className="text-sm text-muted-foreground">
              See also: <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link> • <Link href="/guidelines" className="text-primary hover:underline">Usage Guidelines</Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
