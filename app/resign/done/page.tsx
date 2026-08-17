import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function ResignationIntakeDonePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Request received</CardTitle>
          <CardDescription>HR has been notified and will take it from here.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            You don&apos;t need to do anything else right now — HR will reach out if they need more details. You can close this page.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
