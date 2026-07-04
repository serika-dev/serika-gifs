import { redirect } from 'next/navigation'

// Short public alias: gifs.serika.dev/docs -> full developer docs
export default function DocsPage() {
  redirect('/developer/docs/getting-started')
}
