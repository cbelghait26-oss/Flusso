export type SetupPayload = {
  name?: string;
  targetLevel?: "casual" | "regular" | "serious" | "determined";
  targetMinutesPerDay?: 30 | 60 | 120 | 180;
};

export type RootStackParamList = {
  SignIn: undefined;
  EmailLogin: { isSignUp?: boolean };

  Q1NameScreen: { setup?: SetupPayload } | undefined;
  Q2OrganizeScreen: { setup?: SetupPayload } | undefined;
  Q3FocusScreen: { setup?: SetupPayload } | undefined;
  Q4QuoteScreen: { setup?: SetupPayload } | undefined;
  Q5TargetScreen: { setup?: SetupPayload } | undefined;

  // Main app
  MainTabs: { setup?: SetupPayload } | undefined;
  FocusZoneScreen: undefined;

  // overlay
  Search: undefined;

};
