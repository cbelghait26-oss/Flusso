self.__BUILD_MANIFEST = {
  "__rewrites": {
    "afterFiles": [
      {
        "source": "/",
        "destination": "/landing.html"
      },
      {
        "source": "/about",
        "destination": "/about.html"
      },
      {
        "source": "/privacy",
        "destination": "/privacy-policy.html"
      },
      {
        "source": "/terms",
        "destination": "/terms-and-conditions.html"
      }
    ],
    "beforeFiles": [],
    "fallback": []
  },
  "sortedPages": [
    "/_app",
    "/_error"
  ]
};self.__BUILD_MANIFEST_CB && self.__BUILD_MANIFEST_CB()