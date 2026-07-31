import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function OnboardingDonePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>You&rsquo;re all set!</CardTitle>
          <CardDescription>Your profile has been submitted.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            HR will follow up with next steps. You can close this page now.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
