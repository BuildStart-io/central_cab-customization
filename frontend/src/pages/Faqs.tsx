import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useStaffAccess } from "@/hooks/useStaffAccess";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, HelpCircle, Loader2, Link, AlertTriangle, Crosshair, Car, Truck, Package, MessageCircleQuestion } from "lucide-react";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import LimitWarningBanner from "@/components/LimitWarningBanner";
import { Badge } from "@/components/ui/badge";
import FaqMediaUpload from "@/components/faqs/FaqMediaUpload";

export type FaqCategory = "hire" | "rent_a_car" | "delivery" | "ask_a_question";

export const FAQ_CATEGORIES = [
  { id: "hire", label: "Hire (Cabs)", icon: "🚖", lucideIcon: Car, description: "Cabs, transport rides & fares" },
  { id: "rent_a_car", label: "Rent a Car", icon: "🚗", lucideIcon: Car, description: "Self-drive & vehicle rentals" },
  { id: "delivery", label: "Delivery", icon: "📦", lucideIcon: Package, description: "Package & courier deliveries" },
  { id: "ask_a_question", label: "Ask a Question", icon: "❓", lucideIcon: MessageCircleQuestion, description: "General inquiries & policies" },
] as const;

interface Faq {
  id: string;
  question: string;
  answer: string;
  category?: string | null;
  product_id: string | null;
  is_active: boolean;
  is_tracked: boolean;
  media_urls: string[] | null;
  created_at: string;
}

interface Product {
  id: string;
  name: string;
}

export default function Faqs() {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<Faq | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("hire");
  const { toast } = useToast();
  const { user } = useAuth();
  const { effectiveUserId } = useStaffAccess();
  const { canAddFaq, usage, limits, isPaused } = usePlanLimits();

  // Form state
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [category, setCategory] = useState<string>("hire");
  const [productId, setProductId] = useState<string>("");
  const [isActive, setIsActive] = useState(true);
  const [isTracked, setIsTracked] = useState(false);
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);

  const fetchData = async () => {
    try {
      const [faqsRes, productsRes] = await Promise.all([
        supabase.from("faqs").select("*").order("created_at", { ascending: false }),
        supabase.from("products").select("id, name").eq("is_active", true),
      ]);

      if (faqsRes.error) throw faqsRes.error;
      if (productsRes.error) throw productsRes.error;

      setFaqs((faqsRes.data as any) || []);
      setProducts(productsRes.data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetForm = () => {
    setQuestion("");
    setAnswer("");
    // Default to the currently selected tab (or 'hire' if 'all')
    setCategory(activeTab === "all" ? "hire" : activeTab);
    setProductId("");
    setIsActive(true);
    setIsTracked(false);
    setMediaUrls([]);
    setEditingFaq(null);
  };

  const openAddDialog = () => {
    resetForm();
    setCategory(activeTab === "all" ? "hire" : activeTab);
    setDialogOpen(true);
  };

  const openEditDialog = (faq: Faq) => {
    setEditingFaq(faq);
    setQuestion(faq.question);
    setAnswer(faq.answer);
    setCategory(faq.category || "ask_a_question");
    setProductId(faq.product_id || "");
    setIsActive(faq.is_active);
    setIsTracked(faq.is_tracked);
    setMediaUrls(faq.media_urls || []);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const faqData = {
        question,
        answer,
        category: category || "ask_a_question",
        product_id: productId || null,
        is_active: isActive,
        is_tracked: isTracked,
        media_urls: mediaUrls,
        user_id: effectiveUserId || user!.id,
      };

      if (editingFaq) {
        const { error } = await supabase
          .from("faqs")
          .update(faqData)
          .eq("id", editingFaq.id);

        if (error) throw error;
        toast({ title: "FAQ updated successfully" });
      } else {
        if (!canAddFaq) {
          toast({
            title: "FAQ limit reached",
            description: `Your plan allows ${limits?.max_faqs} FAQs. Upgrade to add more.`,
            variant: "destructive"
          });
          setSaving(false);
          return;
        }
        const { error } = await supabase
          .from("faqs")
          .insert([faqData]);

        if (error) throw error;
        toast({ title: "FAQ created successfully" });
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error saving FAQ",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this FAQ?")) return;

    try {
      const { error } = await supabase.from("faqs").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "FAQ deleted successfully" });
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error deleting FAQ",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getProductName = (productId: string | null) => {
    if (!productId) return null;
    const product = products.find(p => p.id === productId);
    return product?.name;
  };

  // Filter faqs by active category tab
  const filteredFaqs = activeTab === "all"
    ? faqs
    : faqs.filter(f => (f.category || "ask_a_question") === activeTab);

  const getCategoryCount = (catId: string) => {
    if (catId === "all") return faqs.length;
    return faqs.filter(f => (f.category || "ask_a_question") === catId).length;
  };

  const renderCategoryBadge = (cat?: string | null) => {
    switch (cat) {
      case "hire":
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1 text-xs font-medium">🚖 Hire</Badge>;
      case "rent_a_car":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1 text-xs font-medium">🚗 Rent a Car</Badge>;
      case "delivery":
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 text-xs font-medium">📦 Delivery</Badge>;
      case "ask_a_question":
      default:
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 gap-1 text-xs font-medium">❓ Question</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <LimitWarningBanner type="faqs" />
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Service FAQs & AI Knowledge</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Manage category-specific questions and AI answers for Hire, Rent a Car, Delivery, and Questions
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <div className="flex flex-col items-end">
              <Button
                onClick={openAddDialog}
                disabled={isPaused || (!canAddFaq && !editingFaq)}
                className="w-full sm:w-auto shadow-sm"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add FAQ
              </Button>
              {!canAddFaq && (
                <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                  <AlertTriangle className="h-3 w-3" />
                  Limit reached ({usage?.faqs}/{limits?.max_faqs})
                </p>
              )}
            </div>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingFaq ? "Edit FAQ" : "Add New FAQ"}</DialogTitle>
                <DialogDescription>
                  {editingFaq ? "Update the FAQ details and assigned category" : "Create a new FAQ for your chatbot service flow"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Category Selection */}
                <div className="space-y-2">
                  <Label htmlFor="category" className="font-semibold">Service Category *</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger id="category" className="bg-background">
                      <SelectValue placeholder="Select service category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hire">🚖 Hire (Cabs / Transport)</SelectItem>
                      <SelectItem value="rent_a_car">🚗 Rent a Car</SelectItem>
                      <SelectItem value="delivery">📦 Delivery Service</SelectItem>
                      <SelectItem value="ask_a_question">❓ Ask a Question (General FAQs)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    This FAQ will be queried by the AI when customers are in this service flow.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="question">Question *</Label>
                  <Input
                    id="question"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="e.g., Can I cancel my booking for free?"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="answer">Answer *</Label>
                  <Textarea
                    id="answer"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Provide a clear, accurate answer for customers..."
                    rows={4}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Attachments (Optional)</Label>
                  <FaqMediaUpload value={mediaUrls} onChange={setMediaUrls} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="product">Link to Product (Optional)</Label>
                    <Select value={productId || "none"} onValueChange={(val) => setProductId(val === "none" ? "" : val)}>
                      <SelectTrigger id="product">
                        <SelectValue placeholder="Select a product" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No product link</SelectItem>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Link this FAQ to a specific product for contextual responses
                    </p>
                  </div>
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="active"
                        checked={isActive}
                        onCheckedChange={setIsActive}
                      />
                      <Label htmlFor="active">Active</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="tracked"
                        checked={isTracked}
                        onCheckedChange={setIsTracked}
                      />
                      <Label htmlFor="tracked" className="flex items-center gap-1.5">
                        <Crosshair className="h-3.5 w-3.5" />
                        Track Usage
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      When tracked, customers who trigger this FAQ will be highlighted in Chats
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : editingFaq ? (
                      "Update FAQ"
                    ) : (
                      "Create FAQ"
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* 4 Service Category Sub-Tabs */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3 border-b">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Service Knowledge Categories</CardTitle>
                <CardDescription>
                  Filter FAQs by the 4 automated service flows
                </CardDescription>
              </div>
              <Badge variant="secondary" className="w-fit text-xs">
                Total: {faqs.length} FAQs
              </Badge>
            </div>
            <div className="pt-3">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid grid-cols-2 sm:grid-cols-5 h-auto p-1 bg-muted/60 gap-1">
                  <TabsTrigger value="hire" className="py-2 text-xs sm:text-sm flex items-center justify-center gap-1.5">
                    <span>🚖</span>
                    <span>Hire</span>
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] bg-background">
                      {getCategoryCount("hire")}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="rent_a_car" className="py-2 text-xs sm:text-sm flex items-center justify-center gap-1.5">
                    <span>🚗</span>
                    <span>Rent a Car</span>
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] bg-background">
                      {getCategoryCount("rent_a_car")}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="delivery" className="py-2 text-xs sm:text-sm flex items-center justify-center gap-1.5">
                    <span>📦</span>
                    <span>Delivery</span>
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] bg-background">
                      {getCategoryCount("delivery")}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="ask_a_question" className="py-2 text-xs sm:text-sm flex items-center justify-center gap-1.5">
                    <span>❓</span>
                    <span>Questions</span>
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] bg-background">
                      {getCategoryCount("ask_a_question")}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="all" className="py-2 text-xs sm:text-sm flex items-center justify-center gap-1.5 col-span-2 sm:col-span-1">
                    <span>📑</span>
                    <span>All FAQs</span>
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] bg-background">
                      {getCategoryCount("all")}
                    </Badge>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredFaqs.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <HelpCircle className="h-12 w-12 mx-auto text-muted-foreground/60" />
                <p className="text-muted-foreground font-medium">
                  No FAQs in this category yet.
                </p>
                <Button variant="outline" size="sm" onClick={openAddDialog}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add FAQ to {activeTab === "all" ? "Knowledge Base" : FAQ_CATEGORIES.find(c => c.id === activeTab)?.label}
                </Button>
              </div>
            ) : (
              <>
                {/* Mobile: Card layout */}
                <div className="space-y-3 md:hidden">
                  {filteredFaqs.map((faq) => (
                    <div key={faq.id} className="border rounded-lg p-4 space-y-3 bg-card shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            {renderCategoryBadge(faq.category)}
                            {faq.is_tracked && (
                              <Badge variant="outline" className="flex-shrink-0 gap-1 text-[10px] border-primary/50 text-primary">
                                <Crosshair className="h-2.5 w-2.5" />
                                Tracked
                              </Badge>
                            )}
                          </div>
                          <p className="font-semibold text-sm line-clamp-2">{faq.question}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{faq.answer}</p>
                        </div>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium flex-shrink-0 ${
                          faq.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {faq.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t">
                        {faq.product_id ? (
                          <span className="inline-flex items-center gap-1 text-xs text-primary">
                            <Link className="h-3 w-3" />
                            {getProductName(faq.product_id)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">General</span>
                        )}
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(faq)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(faq.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop: Table layout */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[140px]">Category</TableHead>
                        <TableHead>Question & Answer</TableHead>
                        <TableHead className="w-[140px]">Linked Product</TableHead>
                        <TableHead className="w-[100px]">Status</TableHead>
                        <TableHead className="w-[100px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredFaqs.map((faq) => (
                        <TableRow key={faq.id}>
                          <TableCell>
                            {renderCategoryBadge(faq.category)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-start gap-2">
                              <div className="space-y-0.5">
                                <p className="font-semibold text-sm line-clamp-1">{faq.question}</p>
                                <p className="text-xs text-muted-foreground line-clamp-1">{faq.answer}</p>
                              </div>
                              {faq.is_tracked && (
                                <Badge variant="outline" className="flex-shrink-0 gap-1 text-[10px] border-primary/50 text-primary mt-0.5">
                                  <Crosshair className="h-2.5 w-2.5" />
                                  Tracked
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {faq.product_id ? (
                              <span className="inline-flex items-center gap-1 text-xs text-primary font-medium">
                                <Link className="h-3 w-3" />
                                {getProductName(faq.product_id)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              faq.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {faq.is_active ? "Active" : "Inactive"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(faq)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(faq.id)}>
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
