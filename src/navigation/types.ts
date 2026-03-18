export type SetupPayload = {
  name?: string;
  focusSelection?: string[];
  focusMinutes?: 15 | 30 | 60 | 90 | 120;
};

export type RootStackParamList = {
  SignIn: undefined;
  EmailLogin: { isSignUp?: boolean };
  ForgotPassword: undefined;

  Q0WelcomeScreen: { setup?: SetupPayload } | undefined;
  Q1NameScreen: { setup?: SetupPayload } | undefined;
  Q2MovementScreen: { setup?: SetupPayload } | undefined;
  Q3WhyScreen: { setup?: SetupPayload } | undefined;
  Q4QuoteScreen: { setup?: SetupPayload } | undefined;
  Q5ReflectionScreen: { setup?: SetupPayload } | undefined;
  Q6DirectedFocusScreen: { setup?: SetupPayload } | undefined;
  Q7ModelScreen: { setup?: SetupPayload } | undefined;
  Q8FocusCommitScreen: { setup?: SetupPayload } | undefined;
  Q9ClosingScreen: { setup?: SetupPayload } | undefined;

  // Email verification gate
  VerifyEmail: { afterVerifyRoute?: keyof RootStackParamList } | undefined;

  // Main app
  MainTabs: { setup?: SetupPayload } | undefined;
  FocusZoneScreen: undefined;

  // overlay
  Search: undefined;

  // Social
  Social: undefined;
  AddFriend: undefined;
};
