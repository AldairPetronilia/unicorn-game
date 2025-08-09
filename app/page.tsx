import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-400 via-pink-300 to-blue-300">
      <div className="text-center p-8 bg-white/90 rounded-3xl shadow-2xl max-w-md">
        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          🦄 Labubu Rainbow Catch! 🌈
        </h1>
        <p className="text-gray-700 mb-8 text-lg">
          A cute and addictive game featuring Labubu, unicorns, and rainbows!
        </p>
        <Link
          href="/labubu-game"
          className="inline-block px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold text-xl rounded-full hover:scale-105 transition-transform shadow-lg"
        >
          Play Now! 🎮
        </Link>
        <div className="mt-6 text-sm text-gray-600">
          <p>🎯 Catch the falling Labubus</p>
          <p>🌈 Collect rainbow power-ups</p>
          <p>💖 Perfect for mobile play</p>
        </div>
      </div>
    </div>
  );
}