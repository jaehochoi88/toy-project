export default function AuthCodeErrorPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-16 text-center">
      <h1 className="text-2xl font-semibold">Sign in failed</h1>
      <p className="text-muted-foreground">
        Something went wrong completing sign in. Please try again.
      </p>
    </div>
  );
}
