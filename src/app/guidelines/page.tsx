import { Header } from '@/components/header'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Check, X, AlertTriangle, Shield, Zap, Crown } from 'lucide-react'

export const metadata = {
  title: 'Usage Guidelines - SerikaGifs',
  description: 'API Usage Guidelines and tier requirements for SerikaGifs',
}

const TIER_REQUIREMENTS = [
  {
    tier: 'Tier 1',
    limit: '1,000 requests/hour',
    color: 'bg-zinc-500',
    icon: <Shield className="h-5 w-5" />,
    attribution: 'None required',
    branding: 'None required',
    commercial: true,
    requirements: [
      { text: 'Follow content policies', required: true },
      { text: 'No redistribution of bulk data', required: true },
      { text: 'Attribution', required: false },
      { text: 'Branding requirements', required: false },
    ],
    description: 'Perfect for personal projects, hobbyists, and testing. No attribution required.',
  },
  {
    tier: 'Tier 2',
    limit: '10,000 requests/hour',
    color: 'bg-blue-500',
    icon: <Shield className="h-5 w-5" />,
    attribution: 'Recommended',
    branding: 'None required',
    commercial: true,
    requirements: [
      { text: 'Follow content policies', required: true },
      { text: 'No redistribution of bulk data', required: true },
      { text: 'Attribution recommended', required: false },
      { text: 'Branding requirements', required: false },
    ],
    description: 'For growing applications. Attribution appreciated but not required.',
  },
  {
    tier: 'Tier 3',
    limit: '100,000 requests/hour',
    color: 'bg-purple-500',
    icon: <Zap className="h-5 w-5" />,
    attribution: 'Required',
    branding: 'Link to SerikaGifs',
    commercial: true,
    requirements: [
      { text: 'Follow content policies', required: true },
      { text: 'No redistribution of bulk data', required: true },
      { text: 'Attribution required in app/website', required: true },
      { text: 'Link to serikagifs.com somewhere visible', required: true },
    ],
    description: 'For established applications. Must include attribution and link.',
  },
  {
    tier: 'Tier 4',
    limit: '1,000,000 requests/hour',
    color: 'bg-amber-500',
    icon: <Zap className="h-5 w-5" />,
    attribution: 'Required + Logo',
    branding: '"Powered by SerikaGifs"',
    commercial: true,
    requirements: [
      { text: 'Follow content policies', required: true },
      { text: 'No redistribution of bulk data', required: true },
      { text: 'Display "Powered by SerikaGifs" badge', required: true },
      { text: 'Include SerikaGifs logo or text attribution', required: true },
      { text: 'Link to serikagifs.com in attribution', required: true },
    ],
    description: 'For high-traffic applications. Must display "Powered by SerikaGifs" badge.',
  },
  {
    tier: 'Tier 5',
    limit: 'Unlimited',
    color: 'bg-emerald-500',
    icon: <Crown className="h-5 w-5" />,
    attribution: 'Required + Named Integration',
    branding: '"Search SerikaGifs" in UI',
    commercial: true,
    requirements: [
      { text: 'Follow content policies', required: true },
      { text: 'No redistribution of bulk data', required: true },
      { text: 'Display "Powered by SerikaGifs" badge prominently', required: true },
      { text: 'Include SerikaGifs branding in search UI', required: true },
      { text: 'Use "Search SerikaGifs" or similar naming in GIF search features', required: true },
      { text: 'Link to serikagifs.com in attribution', required: true },
      { text: 'Compliance review may be required', required: true },
    ],
    description: 'Unlimited access for partners. Must include "Search SerikaGifs" naming in GIF features.',
  },
]

export default function GuidelinesPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-3xl font-bold mb-2">Usage Guidelines</h1>
        <p className="text-muted-foreground mb-8">Last updated: January 29, 2026</p>

        <div className="prose prose-invert prose-zinc max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-4">Overview</h2>
            <p className="text-muted-foreground leading-relaxed">
              These Usage Guidelines govern how you may use the SerikaGifs API and Service. 
              Different API tiers have different requirements. Higher tiers provide more capacity 
              but require more visibility for SerikaGifs branding. All usage must comply with 
              Dutch law and EU regulations.
            </p>
          </section>

          {/* Tier Requirements Cards */}
          <section>
            <h2 className="text-xl font-semibold mb-6">Tier Requirements</h2>
            <div className="space-y-4">
              {TIER_REQUIREMENTS.map((tier) => (
                <Card key={tier.tier} className="border-border/50">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${tier.color} text-white`}>
                          {tier.icon}
                        </div>
                        <div>
                          <CardTitle className="text-lg">{tier.tier}</CardTitle>
                          <CardDescription>{tier.limit}</CardDescription>
                        </div>
                      </div>
                      <Badge variant="outline" className={tier.color.replace('bg-', 'border-').replace('500', '500/50')}>
                        {tier.tier === 'Tier 5' ? 'Partner' : tier.tier === 'Tier 4' ? 'Enterprise' : tier.tier === 'Tier 3' ? 'Business' : tier.tier === 'Tier 2' ? 'Growth' : 'Starter'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">{tier.description}</p>
                    
                    <div className="grid sm:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Attribution:</span>
                        <span className="ml-2 font-medium">{tier.attribution}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Branding:</span>
                        <span className="ml-2 font-medium">{tier.branding}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="text-sm font-medium">Requirements:</span>
                      <ul className="space-y-1">
                        {tier.requirements.map((req, idx) => (
                          <li key={idx} className="flex items-center gap-2 text-sm">
                            {req.required ? (
                              <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                            ) : (
                              <X className="h-4 w-4 text-muted-foreground shrink-0" />
                            )}
                            <span className={req.required ? 'text-foreground' : 'text-muted-foreground'}>
                              {req.text}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Content Policy */}
          <section className="pt-8">
            <h2 className="text-xl font-semibold mb-4">Content Policy</h2>
            <div className="text-muted-foreground leading-relaxed space-y-4">
              <p>All users, regardless of tier, must comply with our content policy. The following is prohibited:</p>
              
              <Card className="border-red-500/30 bg-red-500/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-red-500 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Prohibited Content
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc pl-6 space-y-2 text-sm">
                    <li><strong>Child Sexual Abuse Material (CSAM):</strong> Zero tolerance. Immediately reported to authorities.</li>
                    <li><strong>Illegal content:</strong> Content illegal under Dutch or EU law</li>
                    <li><strong>Violence & Gore:</strong> Graphic violence, torture, or gore</li>
                    <li><strong>Hate speech:</strong> Content promoting hatred based on protected characteristics</li>
                    <li><strong>Harassment:</strong> Targeted harassment or doxxing of individuals</li>
                    <li><strong>Malware:</strong> Files containing viruses, malware, or harmful code</li>
                    <li><strong>Copyright infringement:</strong> Content you don&apos;t have rights to distribute</li>
                    <li><strong>Spam:</strong> Automated bulk uploads or spam content</li>
                    <li><strong>Deceptive content:</strong> Deepfakes or manipulated media intended to deceive</li>
                  </ul>
                </CardContent>
              </Card>

              <p>
                We comply with the EU Digital Services Act (DSA) and will remove illegal content upon valid notice. 
                Repeat violators will have their accounts terminated.
              </p>
            </div>
          </section>

          {/* API Usage Rules */}
          <section className="pt-4">
            <h2 className="text-xl font-semibold mb-4">API Usage Rules</h2>
            <div className="text-muted-foreground leading-relaxed space-y-4">
              <div>
                <h3 className="text-lg font-medium text-foreground mb-2">Rate Limiting</h3>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Respect your tier&apos;s rate limits</li>
                  <li>Implement exponential backoff when receiving 429 errors</li>
                  <li>Do not attempt to circumvent rate limits through multiple accounts or keys</li>
                  <li>Cache responses where appropriate to reduce API calls</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-medium text-foreground mb-2">Prohibited API Uses</h3>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Scraping or bulk downloading our entire database</li>
                  <li>Creating a competing GIF hosting service using our API</li>
                  <li>Reselling API access without authorization</li>
                  <li>Using the API for illegal purposes</li>
                  <li>Reverse engineering our systems</li>
                  <li>Interfering with service operation or security</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-medium text-foreground mb-2">Fair Use</h3>
                <p>
                  Unlimited tier users are still subject to fair use policies. We reserve the right to 
                  throttle or suspend accounts that negatively impact service performance for other users.
                </p>
              </div>
            </div>
          </section>

          {/* Attribution Examples */}
          <section className="pt-4">
            <h2 className="text-xl font-semibold mb-4">Attribution Examples</h2>
            <div className="text-muted-foreground leading-relaxed space-y-4">
              <div>
                <h3 className="text-lg font-medium text-foreground mb-2">Tier 3: Basic Attribution</h3>
                <Card className="border-border/50 bg-muted/30">
                  <CardContent className="py-4">
                    <p className="text-sm">Include a text link in your application:</p>
                    <code className="block mt-2 text-xs bg-background p-2 rounded">
                      GIFs provided by &lt;a href=&quot;https://serikagifs.com&quot;&gt;SerikaGifs&lt;/a&gt;
                    </code>
                  </CardContent>
                </Card>
              </div>

              <div>
                <h3 className="text-lg font-medium text-foreground mb-2">Tier 4: Powered By Badge</h3>
                <Card className="border-border/50 bg-muted/30">
                  <CardContent className="py-4">
                    <p className="text-sm">Display a &quot;Powered by&quot; badge near GIF content:</p>
                    <div className="mt-2 flex items-center gap-2 bg-background p-2 rounded w-fit">
                      <span className="text-xs text-muted-foreground">Powered by</span>
                      <span className="text-xs font-semibold text-primary">SerikaGifs</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div>
                <h3 className="text-lg font-medium text-foreground mb-2">Tier 5: Named Integration</h3>
                <Card className="border-border/50 bg-muted/30">
                  <CardContent className="py-4">
                    <p className="text-sm">Include SerikaGifs in your GIF search feature naming:</p>
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center gap-2 bg-background p-3 rounded">
                        <span className="text-sm">🔍</span>
                        <span className="text-sm text-muted-foreground">Search SerikaGifs...</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Or: &quot;Find GIFs on SerikaGifs&quot;, &quot;SerikaGifs Search&quot;, etc.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>

          {/* Requesting Higher Tiers */}
          <section className="pt-4">
            <h2 className="text-xl font-semibold mb-4">Requesting Higher Tiers</h2>
            <div className="text-muted-foreground leading-relaxed space-y-3">
              <p>
                To request a higher API tier, go to your <Link href="/settings" className="text-primary hover:underline">Settings page</Link> and 
                click the upgrade button next to your API key. In your request, include:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Your application name and description</li>
                <li>Expected monthly API usage</li>
                <li>How you plan to attribute SerikaGifs</li>
                <li>Your website or app store link (if applicable)</li>
              </ul>
              <p>
                We review requests within 3-5 business days. Approval is at our discretion and may be 
                subject to compliance verification for Tier 5.
              </p>
            </div>
          </section>

          {/* Enforcement */}
          <section className="pt-4">
            <h2 className="text-xl font-semibold mb-4">Enforcement</h2>
            <div className="text-muted-foreground leading-relaxed space-y-3">
              <p>Violations of these guidelines may result in:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Warning:</strong> First-time minor violations</li>
                <li><strong>Tier downgrade:</strong> Attribution or branding violations</li>
                <li><strong>Rate limit reduction:</strong> Abuse of API resources</li>
                <li><strong>Temporary suspension:</strong> Repeated violations</li>
                <li><strong>Permanent ban:</strong> Severe violations or illegal content</li>
              </ul>
              <p>
                We reserve the right to modify, suspend, or terminate API access at any time for 
                violations of these guidelines or our <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>.
              </p>
            </div>
          </section>

          {/* Changes */}
          <section className="pt-4">
            <h2 className="text-xl font-semibold mb-4">Changes to Guidelines</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update these guidelines periodically. Material changes affecting your tier requirements 
              will be notified at least 30 days in advance. Continued use of the API after changes take effect 
              constitutes acceptance of the revised guidelines.
            </p>
          </section>

          <div className="border-t border-border pt-8 mt-12">
            <p className="text-sm text-muted-foreground">
              See also: <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link> • <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
