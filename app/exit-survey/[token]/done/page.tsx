import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function ExitSurveyDonePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Thank you!</CardTitle>
          <CardDescription>Your feedback has been submitted.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            We wish you the best in your next chapter. You can close this page now.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
