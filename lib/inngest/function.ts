import { inngest } from "./client";
import {
  NEWS_SUMMARY_EMAIL_PROMPT,
  PERSONALIZED_WELCOME_EMAIL_PROMPT,
} from "./prompts";
import { sendNewsSummaryEmail, sendWelcomeEmail } from "../nodemailer";
import { getAllUsersForEmail } from "../actions/user.ations";
import { getNews } from "../actions/finnhub.actions";
import { getWatchlistSymbolsByEmail } from "../actions/watchlist.actions";
import { formatDateToday } from "../utils";

export const sendSignUpEmail = inngest.createFunction(
  { id: "sign-up-email" },
  { event: "app/userAgent.created" },
  async ({ event, step }) => {
    const userProfile = `
            - Country: ${event.data.country}
            - Investment Goals: ${event.data.investmentGoals}
            - Risk Tolerance: ${event.data.riskTolerance}
            - Preferred Industry: ${event.data.preferredIndustry}
        `;

    const prompt = PERSONALIZED_WELCOME_EMAIL_PROMPT.replace(
      "{{userProfile}}",
      userProfile
    );

    const response = await step.ai.infer("generate-welcome-intro", {
      model: step.ai.models.gemini({ model: "gemini-2.5-flash-lite" }),
      body: {
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
      },
    });

    await step.run("send-welcome-email", async () => {
      const part = response.candidates?.[0]?.content?.parts?.[0];
      const introText =
        (part && "text" in part ? part.text : null) ||
        "Thanks for joining Signalist. You now have the tools to track markets and make smarter moves.";
      const {
        data: { email, name },
      } = event;
      return await sendWelcomeEmail({
        email,
        name,
        intro: introText,
      });
    });

    return {
      success: true,
      message: "Welcome email sent successfully",
    };
  }
);

export const sendDailyNewsSummary = inngest.createFunction(
  { id: "daily-news-summary" },
  [{ event: "app/send.daily.news" }, { cron: " 0 12 * * *" }], // Every day at 12:00 PM
  async ({ step }) => {
    // step 1: get all users for new delivery
    const users = await step.run("get-all-users", getAllUsersForEmail);

    if (!users || users.length === 0)
      return { success: false, message: "No users found" };

    // step 2: fetch personalized news for each user
    const results = await step.run("fetch-user-news", async () => {
      const perUser: Array<{
        user: User;
        articles: MarketNewsArticle[];
      }> = [];
      for (const user of users as User[]) {
        try {
          const symbols = await getWatchlistSymbolsByEmail(user.email);
          let articles = await getNews(symbols);
          // Limit to 6 articles
          articles = (articles || []).slice(0, 6);

          if (!articles || articles.length === 0) {
            articles = await getNews(); // Fetch general market news if no personalized news
            articles = (articles || []).slice(0, 6);
          }

          perUser.push({ user, articles });
        } catch (error) {
          console.log("Error fetching news for user", user.email, error);
          perUser.push({ user, articles: [] });
        }
      }
      return perUser;
    });

    // step 3: summarize news via AI
    const userNewsSummaries: { user: User; newsContent: string | null }[] = [];

    for (const { user, articles } of results) {
      try {
        const prompt = NEWS_SUMMARY_EMAIL_PROMPT.replace(
          "{{newsData}}",
          JSON.stringify(articles, null, 2)
        );

        const response = await step.ai.infer(`summarize-news-${user.email}`, {
          model: step.ai.models.gemini({ model: "gemini-2.5-flash-lite" }),
          body: {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
          },
        });

        const part = response.candidates?.[0]?.content?.parts?.[0];
        const newsContent =
          (part && "text" in part ? part.text : null) || "No market news.";

        userNewsSummaries.push({ user, newsContent });
      } catch (error) {
        console.log("Error summarizing news for user", user.email, error);
        userNewsSummaries.push({ user, newsContent: null });
      }
    }

    // Step 4: send the emails
    await step.run("send-news-emails", async () => {
      await Promise.all(
        userNewsSummaries.map(async ({ user, newsContent }) => {
          if (!newsContent) return false;

          return await sendNewsSummaryEmail({
            email: user.email,
            date: formatDateToday,
            newsContent,
          });
        })
      );
    });

    return { success: true, message: "News summary emails sent" } as const;
  }
);
