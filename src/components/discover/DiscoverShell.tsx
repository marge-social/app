"use client";

import { useMemo, useState } from "react";
import {
  DEFAULT_SLIDERS,
  INITIAL_FOLLOWING,
  orderPosts,
  POSTS,
  type SliderState,
} from "@/lib/mock/discover";
import { ActiveThreads } from "@/components/discover/ActiveThreads";
import { AlgoControls } from "@/components/discover/AlgoControls";
import { AlgoNote } from "@/components/discover/AlgoNote";
import { FeaturedAuthors } from "@/components/discover/FeaturedAuthors";
import { FeedComposer } from "@/components/discover/FeedComposer";
import { LeftRail } from "@/components/discover/LeftRail";
import { PostCard } from "@/components/discover/PostCard";

/**
 * Shell « Découvrir » — grille 3 colonnes du fil visiteur. Île client : porte
 * l'état réellement interactif (curseurs qui réordonnent le fil, suivis,
 * enregistrements, bascules d'affichage). Données 100 % démo, rien de câblé.
 */
export function DiscoverShell() {
  const [sliders, setSliders] = useState<SliderState>(DEFAULT_SLIDERS);
  const [following, setFollowing] = useState<Record<string, boolean>>(INITIAL_FOLLOWING);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [showReason, setShowReason] = useState(true);
  const [showReputation, setShowReputation] = useState(true);

  const setSlider = (axis: keyof SliderState, value: number) =>
    setSliders((s) => ({ ...s, [axis]: value }));
  const resetSliders = () => setSliders({ depth: 0.5, discovery: 0.5, controversy: 0.5 });
  const toggleFollow = (id: string) => setFollowing((f) => ({ ...f, [id]: !f[id] }));
  const toggleSave = (id: string) => setSaved((s) => ({ ...s, [id]: !s[id] }));

  // Tri réel par affinité avec les curseurs — logique locale, publique.
  const ordered = useMemo(() => orderPosts(POSTS, sliders), [sliders]);

  return (
    <div
      className="grid-shell"
      data-density="comfy"
      data-show-rep={String(showReputation)}
      data-show-reason={String(showReason)}
    >
      <LeftRail />

      <div className="feed">
        <FeedComposer />
        {ordered.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            saved={!!saved[post.id]}
            onSave={() => toggleSave(post.id)}
          />
        ))}
      </div>

      <aside className="rail" aria-label="Suggestions et réglages">
        <FeaturedAuthors following={following} onToggleFollow={toggleFollow} />
        <ActiveThreads />
        <AlgoNote />
        <AlgoControls
          sliders={sliders}
          setSlider={setSlider}
          reset={resetSliders}
          showReason={showReason}
          showReputation={showReputation}
          onToggleReason={setShowReason}
          onToggleReputation={setShowReputation}
        />
      </aside>
    </div>
  );
}
