import { resolveYouTubeFeedUrl, youtubeVideoId, youtubeEmbedUrl, isYouTubeUrl, isYouTubeFeedUrl } from "@/lib/youtube";

let pass = 0, fail = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = got === want;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `  got=${got} want=${want}`}`);
  ok ? pass++ : fail++;
}

async function main() {
  check("channel URL → feed",
    await resolveYouTubeFeedUrl("https://www.youtube.com/channel/UCBa659QWEk1AI4Tg--mrJ2A"),
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCBa659QWEk1AI4Tg--mrJ2A");
  check("playlist URL → feed",
    await resolveYouTubeFeedUrl("https://www.youtube.com/playlist?list=PL1234567890"),
    "https://www.youtube.com/feeds/videos.xml?playlist_id=PL1234567890");
  check("already a feed → passthrough",
    await resolveYouTubeFeedUrl("https://www.youtube.com/feeds/videos.xml?channel_id=UCxxxxxxxxxxxxxxxxxxxxAA"),
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCxxxxxxxxxxxxxxxxxxxxAA");
  check("non-youtube → null", await resolveYouTubeFeedUrl("https://example.com/blog"), null);

  check("isYouTubeUrl channel", isYouTubeUrl("https://youtube.com/@mkbhd"), true);
  check("isYouTubeUrl bare handle", isYouTubeUrl("@mkbhd"), true);
  check("isYouTubeUrl fediverse handle (not YT)", isYouTubeUrl("@alice@mastodon.social"), false);
  check("isYouTubeFeedUrl", isYouTubeFeedUrl("https://www.youtube.com/feeds/videos.xml?channel_id=UC1"), true);
  check("isYouTubeFeedUrl false for blog", isYouTubeFeedUrl("https://blog.example/rss.xml"), false);

  check("watch?v=", youtubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  check("youtu.be", youtubeVideoId("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  check("shorts", youtubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  check("non-yt link → null", youtubeVideoId("https://example.com/post/1"), null);
  check("embed url", youtubeEmbedUrl("dQw4w9WgXcQ"), "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main();
