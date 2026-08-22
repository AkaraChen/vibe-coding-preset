import type { FC } from "react";
import { APP_NAME } from "@workboard/shared";

const HomePage: FC = () => {
  return (
    <section className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold" data-testid="home-title">
        {APP_NAME}
      </h1>
      <p className="mt-2 text-neutral-700">Guarded lint path is enabled.</p>
    </section>
  );
};

export default HomePage;
