const key = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "";

export function isClerkConfigured() {
  return (
    key.length > 10 &&
    !key.includes("placeholder") &&
    !key.includes("your_") &&
    (key.startsWith("pk_test_") || key.startsWith("pk_live_"))
  );
}

export function getDevUser() {
  return {
    isSignedIn: true,
    user: {
      id: "dev_user_001",
      firstName: "Creator",
      lastName: "",
      fullName: "Creator",
      primaryEmailAddress: { emailAddress: "creator@velora.ai" },
      imageUrl: null,
    },
    session: null,
  };
}