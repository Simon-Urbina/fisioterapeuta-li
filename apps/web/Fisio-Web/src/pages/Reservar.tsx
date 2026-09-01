import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { ReservaWizard } from "./ReservaWizard";

export default function ReservarPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 bg-white py-14 sm:py-20">
        <ReservaWizard />
      </main>
      <Footer />
    </>
  );
}
