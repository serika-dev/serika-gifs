import { Header } from '@/components/header'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, Mail, FileText, Clock } from 'lucide-react'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://gifs.serika.dev'

export const metadata = {
  title: 'DMCA Policy - SerikaGIFs',
  description: 'DMCA and EU Copyright Directive takedown policy and procedures for SerikaGIFs. Submit a copyright infringement claim.',
  keywords: ['dmca policy', 'copyright infringement', 'takedown request', 'copyright policy', 'serikagifs'],
  alternates: {
    canonical: `${SITE_URL}/dmca`,
  },
}

export default function DMCAPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="text-2xl font-semibold mb-2">DMCA Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: January 29, 2026</p>

        <div className="prose prose-zinc max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-4">1. Overview</h2>
            <p className="text-muted-foreground leading-relaxed">
              SerikaGifs respects the intellectual property rights of others and expects users to do the same. 
              In accordance with the Digital Millennium Copyright Act of 1998 (&quot;DMCA&quot;), the EU Copyright Directive 
              (2019/790), and Dutch copyright law (Auteurswet), we will respond expeditiously to claims of 
              copyright infringement committed using our Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">2. Designated Agent</h2>
            <Card className="bg-muted">
              <CardContent className="pt-6">
                <div className="space-y-2 text-sm">
                  <p><strong>DMCA Agent for SerikaGifs</strong></p>
                  <p className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href="mailto:legal@serika.dev" className="text-primary hover:underline">legal@serika.dev</a>
                  </p>
                  <p className="text-muted-foreground text-xs mt-2">
                    Please include &quot;DMCA Takedown Request&quot; in your email subject line.
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">3. Filing a DMCA Takedown Notice</h2>
            <div className="text-muted-foreground leading-relaxed space-y-4">
              <p>
                If you believe that content on SerikaGifs infringes your copyright, please submit a 
                DMCA takedown notice containing the following information:
              </p>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Required Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="list-decimal pl-6 space-y-3 text-sm">
                    <li>
                      <strong>Physical or electronic signature</strong> of the copyright owner or a person 
                      authorized to act on their behalf.
                    </li>
                    <li>
                      <strong>Identification of the copyrighted work</strong> claimed to have been infringed. 
                      If multiple works are covered, provide a representative list.
                    </li>
                    <li>
                      <strong>Identification of the infringing material</strong> and information reasonably 
                      sufficient to locate it (e.g., URLs of the GIFs).
                    </li>
                    <li>
                      <strong>Your contact information</strong>, including address, telephone number, and 
                      email address.
                    </li>
                    <li>
                      <strong>A statement</strong> that you have a good faith belief that use of the material 
                      is not authorized by the copyright owner, its agent, or the law.
                    </li>
                    <li>
                      <strong>A statement</strong>, under penalty of perjury, that the information in the 
                      notification is accurate and that you are authorized to act on behalf of the copyright owner.
                    </li>
                  </ol>
                </CardContent>
              </Card>

              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardContent className="pt-6">
                  <div className="flex gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-amber-500 mb-1">Important Warning</p>
                      <p className="text-muted-foreground">
                        Under 17 U.S.C. § 512(f), any person who knowingly materially misrepresents that 
                        material is infringing may be subject to liability for damages, including costs 
                        and attorneys&apos; fees. Please ensure your claim is legitimate before filing.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">4. Processing of Takedown Requests</h2>
            <div className="text-muted-foreground leading-relaxed space-y-4">
              <div className="grid gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10 text-primary text-sm font-medium shrink-0">1</div>
                      <div>
                        <p className="font-medium">Receipt & Review</p>
                        <p className="text-sm text-muted-foreground">We review the notice for completeness and validity within 24-48 hours.</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10 text-primary text-sm font-medium shrink-0">2</div>
                      <div>
                        <p className="font-medium">Content Removal</p>
                        <p className="text-sm text-muted-foreground">If valid, we expeditiously remove or disable access to the infringing content.</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10 text-primary text-sm font-medium shrink-0">3</div>
                      <div>
                        <p className="font-medium">User Notification</p>
                        <p className="text-sm text-muted-foreground">We notify the user who uploaded the content about the takedown and their right to file a counter-notice.</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">5. Counter-Notification</h2>
            <div className="text-muted-foreground leading-relaxed space-y-4">
              <p>
                If you believe your content was removed by mistake or misidentification, you may file a 
                counter-notification containing:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Your physical or electronic signature</li>
                <li>Identification of the material that was removed and its location before removal</li>
                <li>A statement under penalty of perjury that you have a good faith belief the material was removed by mistake or misidentification</li>
                <li>Your name, address, and telephone number</li>
                <li>A statement consenting to jurisdiction of the federal court in your district (or the Netherlands if outside the US)</li>
                <li>A statement that you will accept service of process from the complaining party</li>
              </ul>
              <p>
                Upon receiving a valid counter-notification, we will forward it to the original complainant. 
                If they do not file a court action within 10-14 business days, we may restore the content.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">6. Repeat Infringers</h2>
            <p className="text-muted-foreground leading-relaxed">
              In accordance with the DMCA and our Terms of Service, we maintain a policy of terminating 
              the accounts of users who are repeat infringers of copyright. We track DMCA notices received 
              against each user and will terminate accounts that receive multiple valid takedown notices.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">7. Bulk Takedown Requests</h2>
            <div className="text-muted-foreground leading-relaxed space-y-3">
              <p>
                For rights holders with multiple works being infringed, we offer a streamlined process:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Submit a single notice covering multiple URLs</li>
                <li>Request removal of all content under a specific tag (if applicable)</li>
                <li>Establish an ongoing relationship for efficient future takedowns</li>
              </ul>
              <p>
                Contact <a href="mailto:legal@serika.dev" className="text-primary hover:underline">legal@serika.dev</a> with 
                &quot;Bulk DMCA Request&quot; in the subject line.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">8. EU Copyright Directive Compliance</h2>
            <p className="text-muted-foreground leading-relaxed">
              In addition to DMCA compliance, we comply with the EU Copyright Directive (2019/790) and 
              Dutch implementation thereof. We implement appropriate measures to ensure the non-availability 
              of works for which rightsholders have provided relevant and necessary information. 
              Rightsholders may request proactive filtering for their works by contacting us directly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">9. Good Faith & Fair Use</h2>
            <p className="text-muted-foreground leading-relaxed">
              We respect fair use, fair dealing, and other copyright exceptions. Before filing a takedown, 
              please consider whether the use may be protected as fair use (US), fair dealing (UK/EU), 
              or under other applicable exceptions. Abuse of the DMCA process to remove legitimate content 
              may result in legal consequences.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">10. Contact</h2>
            <Card className="bg-muted">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <p className="text-sm">
                    <strong>For DMCA takedown requests:</strong>
                  </p>
                  <p className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href="mailto:legal@serika.dev" className="text-primary hover:underline">legal@serika.dev</a>
                  </p>
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    Response time: 24-48 hours
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>

          <div className="border-t border-border pt-8 mt-12">
            <p className="text-sm text-muted-foreground">
              See also: <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link> • <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link> • <Link href="/guidelines" className="text-primary hover:underline">Usage Guidelines</Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
