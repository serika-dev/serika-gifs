import { redirect } from 'next/navigation'

// Short public alias: gifs.serika.dev/docs/<page> -> full developer docs
export default async function DocsAliasPage({
  params,
}: {
  params: Promise<{ page: string }>
}) {
  const { page } = await params
  redirect(`/developer/docs/${page}`)
}
