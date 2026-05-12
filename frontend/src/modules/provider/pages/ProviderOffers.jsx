import { useState, useEffect } from "react";
import ProviderTopNav from "@/modules/provider/components/ProviderTopNav";
import ProviderBottomNav from "@/modules/provider/components/ProviderBottomNav";
import { Tag, Plus, CheckCircle, Clock, Search, Percent, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import API from "@/lib/api";

const ProviderOffers = () => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newOffer, setNewOffer] = useState({ title: "", type: "Flat Discount", value: "", expiry: "" });

  const fetchOffers = async () => {
    try {
      const { data } = await API.get("/provider/offers");
      setOffers(data);
    } catch (err) {
      toast({ title: "Failed to load offers", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOffers();
  }, []);

  const handleCreateOffer = async (e) => {
    e.preventDefault();
    try {
      await API.post("/provider/offers", newOffer);
      toast({ title: "Offer created and sent for approval!" });
      setIsModalOpen(false);
      setNewOffer({ title: "", type: "Flat Discount", value: "", expiry: "" });
      fetchOffers();
    } catch (err) {
      toast({ title: "Failed to create offer", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background pb-20 md:pb-8">
      <ProviderTopNav />
      <main className="container max-w-5xl px-4 py-6 md:py-8 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground">Offers & Deals</h1>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">Create attractive discounts. (Requires admin approval)</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex w-full md:w-auto items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition"
          >
            <Plus className="h-4 w-4" /> Create Offer
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <div className="rounded-2xl border border-border bg-card p-4 md:p-5 shadow-sm">
            <Tag className="h-5 w-5 md:h-6 md:w-6 text-emerald-600 mb-2 md:mb-3" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Active</p>
            <p className="text-xl md:text-3xl font-black text-foreground">1</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 md:p-5 shadow-sm">
            <Clock className="h-5 w-5 md:h-6 md:w-6 text-amber-500 mb-2 md:mb-3" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Pending</p>
            <p className="text-xl md:text-3xl font-black text-foreground">1</p>
          </div>
        </div>

        {/* List of Offers */}
        <section className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-3 items-center justify-between bg-muted/20">
            <h3 className="font-bold text-sm">Your Campaigns</h3>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search offers..." 
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
          <div className="p-0">
            {loading ? (
              <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : offers.length === 0 ? (
               <div className="p-8 text-center text-muted-foreground text-sm">No offers created yet.</div>
            ) : (
               <div className="divide-y divide-border">
                  {offers.map(offer => (
                    <div key={offer._id} className="p-4 md:p-5 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center hover:bg-muted/30 transition-colors">
                      <div className="flex items-start gap-4">
                        <div className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${offer.status === 'Approved' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                          <Percent className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="text-sm md:text-base font-bold text-foreground">{offer.title}</h4>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground font-medium">
                            <span className="flex items-center gap-1"><Tag className="h-3 w-3" /> {offer.type}</span>
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Exp: {new Date(offer.expiry).toLocaleDateString()}</span>
                          </div>
                          {offer.reason && <p className="text-[10px] text-amber-600 mt-2 font-bold bg-amber-50 inline-block px-2 py-0.5 rounded border border-amber-100">{offer.reason}</p>}
                        </div>
                      </div>
                      <div className="flex md:flex-col items-center md:items-end justify-between w-full md:w-auto mt-2 md:mt-0">
                        <span className="font-black text-lg text-foreground bg-muted md:bg-transparent px-3 py-1 rounded-lg md:px-0 md:py-0">{offer.value}</span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider md:mt-1 ${offer.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                          {offer.status === 'Approved' ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />} {offer.status}
                        </span>
                      </div>
                    </div>
                  ))}
               </div>
            )}
          </div>
        </section>
      </main>

      {/* Create Offer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-[40px] bg-card p-8 border border-border shadow-2xl relative">
            <h2 className="text-2xl font-black tracking-tighter mb-1">Create Offer</h2>
            <p className="text-sm text-muted-foreground mb-6">Create a discount. Admin will review it.</p>

            <form onSubmit={handleCreateOffer} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Title</label>
                <input required value={newOffer.title} onChange={e => setNewOffer({...newOffer, title: e.target.value})} className="w-full h-12 px-4 rounded-xl bg-muted border-transparent focus:border-emerald-500/50 focus:bg-background transition-all outline-none font-bold text-sm" placeholder="e.g. Summer AC Discount" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Type</label>
                <select value={newOffer.type} onChange={e => setNewOffer({...newOffer, type: e.target.value})} className="w-full h-12 px-4 rounded-xl bg-muted border-transparent focus:border-emerald-500/50 focus:bg-background transition-all outline-none font-bold text-sm">
                  <option value="Flat Discount">Flat Discount</option>
                  <option value="Percentage">Percentage Off</option>
                  <option value="Combo Offer">Combo Offer</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Value</label>
                <input required value={newOffer.value} onChange={e => setNewOffer({...newOffer, value: e.target.value})} className="w-full h-12 px-4 rounded-xl bg-muted border-transparent focus:border-emerald-500/50 focus:bg-background transition-all outline-none font-bold text-sm" placeholder="e.g. ₹200 Off or 10%" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Expiry Date</label>
                <input required type="date" value={newOffer.expiry} onChange={e => setNewOffer({...newOffer, expiry: e.target.value})} className="w-full h-12 px-4 rounded-xl bg-muted border-transparent focus:border-emerald-500/50 focus:bg-background transition-all outline-none font-bold text-sm" />
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-xs font-bold text-muted-foreground">Cancel</button>
                <button type="submit" className="flex-1 py-3 rounded-xl bg-emerald-600 text-xs font-black text-white shadow-lg hover:bg-emerald-700 transition-all">Submit</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ProviderBottomNav />
    </div>
  );
};

export default ProviderOffers;
