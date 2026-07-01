import { Header } from '@/components/header'
import Link from 'next/link'

export const metadata = {
  title: 'Terms of Service - SerikaGifs',
  description: 'Terms of Service for using SerikaGifs',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="text-2xl font-semibold mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: January 29, 2026</p>

        <div className="prose prose-zinc max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-4">1. Agreement to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using SerikaGifs (&quot;Service&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;). 
              If you disagree with any part of these terms, you do not have permission to access the Service.
              These Terms are governed by Dutch law, in accordance with the regulations of the Netherlands and the European Union.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">2. Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed">
              SerikaGifs provides a platform for hosting, sharing, and discovering animated GIF content. 
              The Service includes a website, API access, and related features. We reserve the right to modify, 
              suspend, or discontinue any aspect of the Service at any time without prior notice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">3. User Accounts</h2>
            <div className="text-muted-foreground leading-relaxed space-y-3">
              <p>When creating an account, you agree to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Provide accurate and complete information</li>
                <li>Maintain the security of your account credentials</li>
                <li>Accept responsibility for all activities under your account</li>
                <li>Notify us immediately of any unauthorized access</li>
                <li>Not share your API keys with unauthorized parties</li>
              </ul>
              <p>
                We reserve the right to suspend or terminate accounts that violate these Terms or our 
                <Link href="/guidelines" className="text-primary hover:underline ml-1">Usage Guidelines</Link>.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">4. API Usage</h2>
            <div className="text-muted-foreground leading-relaxed space-y-3">
              <p>
                Access to our API is subject to rate limits and usage guidelines based on your tier level.
                By using our API, you agree to:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Comply with all applicable rate limits for your tier</li>
                <li>Follow the <Link href="/guidelines" className="text-primary hover:underline">Usage Guidelines</Link> for your tier level</li>
                <li>Not attempt to circumvent rate limiting or authentication mechanisms</li>
                <li>Not use the API for any unlawful purpose</li>
                <li>Not resell API access without explicit written permission</li>
              </ul>
              <p>
                Violation of API terms may result in immediate revocation of API access and account termination.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">5. User Content</h2>
            <div className="text-muted-foreground leading-relaxed space-y-3">
              <p>You retain ownership of content you upload. By uploading content, you grant us a non-exclusive, 
                 worldwide, royalty-free license to use, display, and distribute your content through the Service.</p>
              <p>You agree not to upload content that:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Infringes on intellectual property rights of others</li>
                <li>Contains illegal material under Dutch or EU law</li>
                <li>Contains malware, viruses, or harmful code</li>
                <li>Promotes violence, hatred, or discrimination</li>
                <li>Contains child sexual abuse material (zero tolerance)</li>
                <li>Violates the privacy rights of others</li>
              </ul>
              <p>
                We reserve the right to remove any content that violates these terms without prior notice, 
                in accordance with Article 14 of the EU E-Commerce Directive (2000/31/EC) and the Digital Services Act.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">6. Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Service, including its original content, features, and functionality, is owned by SerikaGifs 
              and protected by international copyright, trademark, and other intellectual property laws. 
              Our trademarks may not be used without prior written consent.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">7. Disclaimer of Warranties</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, 
              either express or implied, including but not limited to implied warranties of merchantability, 
              fitness for a particular purpose, and non-infringement. We do not warrant that the Service will 
              be uninterrupted, secure, or error-free. To the extent permitted by Dutch law (Article 7:17 BW), 
              we disclaim all warranties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">8. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              To the maximum extent permitted under Dutch law (Article 6:109 BW), SerikaGifs shall not be liable 
              for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, 
              data, or other intangible losses, resulting from your use of or inability to use the Service. 
              Our total liability shall not exceed the amount you paid us in the twelve (12) months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">9. Indemnification</h2>
            <p className="text-muted-foreground leading-relaxed">
              You agree to indemnify and hold harmless SerikaGifs, its affiliates, and their respective officers, 
              directors, employees, and agents from any claims, damages, losses, liabilities, and expenses 
              (including legal fees) arising from your use of the Service or violation of these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">10. Governing Law & Jurisdiction</h2>
            <p className="text-muted-foreground leading-relaxed">
              These Terms shall be governed by and construed in accordance with the laws of the Netherlands, 
              without regard to conflict of law principles. Any disputes arising from these Terms or your use 
              of the Service shall be subject to the exclusive jurisdiction of the courts of the Netherlands. 
              For consumers within the EU, this does not affect your rights under mandatory consumer protection 
              laws in your country of residence.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">11. Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to modify these Terms at any time. Material changes will be notified via the 
              Service or email at least 30 days before taking effect. Continued use of the Service after changes 
              become effective constitutes acceptance of the revised Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">12. Severability</h2>
            <p className="text-muted-foreground leading-relaxed">
              If any provision of these Terms is found to be unenforceable or invalid under Dutch law, 
              that provision shall be limited or eliminated to the minimum extent necessary, and the remaining 
              provisions shall remain in full force and effect.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">13. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              For questions about these Terms, please contact us at{' '}
              <a href="mailto:legal@serika.dev" className="text-primary hover:underline">legal@serika.dev</a>.
            </p>
          </section>

          <div className="border-t border-border pt-8 mt-12">
            <p className="text-sm text-muted-foreground">
              See also: <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link> • <Link href="/guidelines" className="text-primary hover:underline">Usage Guidelines</Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
