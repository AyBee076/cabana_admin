"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { TrashIcon } from "@phosphor-icons/react";

import { getItem, setItem } from "@/utils/localStorage";
import { createClient } from "@/lib/supabase/client";
import ProductImagesUpload, {
  ProductImages,
} from "@/components/ProductImagesUpload";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* ----------------------------- schema & types ----------------------------- */

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  description: z.string(),
  price: z
    .string()
    .min(1, "Price is required.")
    .refine((v) => !Number.isNaN(parseFloat(v)) && parseFloat(v) >= 0, {
      message: "Enter a valid price.",
    }),
  categoryId: z.string(),
  fitFeatures: z.string(),
  fabricCare: z.string(),
  images: z
    .object({
      front: z.string(),
      back: z.string(),
      detail: z.string(),
    })
    .refine((v) => Boolean(v.front && v.back), {
      message: "Front and back images are required.",
    }),
  section: z.enum(["men", "women", "accessories"], {
    message: "Select a section.",
  }),
});

type FormValues = z.infer<typeof formSchema>;

type Category = { id: string; name: string };

type DraftVariant = {
  tempId: string;
  size: string;
  color: string;
  stock: string;
};

type SavedDraft = Partial<FormValues> & {
  variants?: DraftVariant[];
  vSize?: string;
  vColor?: string;
  vStock?: string;
};

const STORAGE_KEY = "Form";

const SIZES = ["XS", "S", "M", "L", "XL", "XXL"].map((s) => ({
  label: s,
  value: s,
}));

const SECTIONS = [
  { label: "Men", value: "men" },
  { label: "Women", value: "women" },
  { label: "Accessories", value: "accessories" },
];

/* -------------------------------- component -------------------------------- */

export default function AddProductDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [serverError, setServerError] = useState("");


  // Read the saved draft once
  const savedDraft = useMemo(
    () => getItem(STORAGE_KEY) as SavedDraft | undefined,
    [],
  );

  const emptyImages: ProductImages = { front: "", back: "", detail: "" };

  const form = useForm<FormValues>({
  resolver: zodResolver(formSchema),
  defaultValues: {
    name: savedDraft?.name ?? "",
    description: savedDraft?.description ?? "",
    price: savedDraft?.price ?? "",
    categoryId: savedDraft?.categoryId ?? "",
    section: savedDraft?.section ?? "men",
    fitFeatures: savedDraft?.fitFeatures ?? "",
    fabricCare: savedDraft?.fabricCare ?? "",
    images: savedDraft?.images ?? emptyImages,
  },
});

  // Draft variants (not saved to the database yet)
  const [variants, setVariants] = useState<DraftVariant[]>(
    savedDraft?.variants ?? [],
  );
  const [vSize, setVSize] = useState(savedDraft?.vSize ?? "");
  const [vColor, setVColor] = useState(savedDraft?.vColor ?? "");
  const [vStock, setVStock] = useState(savedDraft?.vStock ?? "0");

  /* ------------------------------ categories ------------------------------ */

  useEffect(() => {
    let ignore = false;

    const fetchCategories = async () => {
      const supabase = createClient();
      const { data } = await supabase.from("categories").select("id, name");
      if (!ignore && data) setCategories(data);
    };

    fetchCategories();
    return () => {
      ignore = true;
    };
  }, []);

  /* ----------------------------- draft in storage ----------------------------- */

  const watched = useWatch({ control: form.control });

  useEffect(() => {
    setItem(STORAGE_KEY, { ...watched, variants, vSize, vColor, vStock });
  }, [watched, variants, vSize, vColor, vStock]);

  const clearDraft = () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.log(error);
    }
  };

  /* -------------------------------- variants -------------------------------- */

  const addDraftVariant = () => {
    if (!vSize || !vColor) return;
    setVariants((prev) => [
      ...prev,
      {
        tempId: crypto.randomUUID(),
        size: vSize,
        color: vColor,
        stock: vStock,
      },
    ]);
    setVSize("");
    setVColor("");
    setVStock("0");
  };

  const removeDraftVariant = (tempId: string) => {
    setVariants((prev) => prev.filter((v) => v.tempId !== tempId));
  };

  /* --------------------------------- submit --------------------------------- */

  async function onSubmit(values: FormValues) {
    setServerError("");
    const supabase = createClient();

    // Step 1: insert the product and get its new id back
    const { data: product, error: productError } = await supabase
      .from("products")
      .insert({
  name: values.name,
  description: values.description,
  price: parseFloat(values.price),
  category_id: values.categoryId || null,
  section: values.section, // <-- add this
  image_url: values.images.front,
  is_deleted: false,
  fit_features: values.fitFeatures,
  fabric_care: values.fabricCare,
})
      .select()
      .single();

    if (productError || !product) {
      console.error("Product insert failed:", productError);
      setServerError(productError?.message ?? "Failed to create product.");
      return;
    }

    // Step 2: insert the front/back/detail rows into product_images
    const imageRows = [
  {
    product_id: product.id,
    image_url: values.images.front,
    image_type: "front",
    is_primary: true,
    display_order: 0,
  },
  {
    product_id: product.id,
    image_url: values.images.back,
    image_type: "back",
    is_primary: false,
    display_order: 1,
  },
];
if (values.images.detail) {
  imageRows.push({
    product_id: product.id,
    image_url: values.images.detail,
    image_type: "detail",
    is_primary: false,
    display_order: 2,
  });
}

    const { error: imagesError } = await supabase
      .from("products_images")
      .insert(imageRows);

    if (imagesError) {
      console.error(
        "Images insert failed:",
        JSON.stringify(imagesError, null, 2),
      );
      setServerError(
        `Product saved, but images failed: ${imagesError.message}`,
      );
      return;
    }

    // Step 3: insert all draft variants using the new product's id
    if (variants.length > 0) {
      const rows = variants.map((v) => ({
        product_id: product.id,
        size: v.size,
        color: v.color,
        stock: parseInt(v.stock, 10) || 0,
      }));

      const { error: variantError } = await supabase
        .from("product_variants")
        .insert(rows);

      if (variantError) {
        console.error(
          "Variants insert failed:",
          JSON.stringify(variantError, null, 2),
        );
        setServerError(
          `Product and images saved, but variants failed: ${variantError.message}. You can add them from the edit page.`,
        );
        return;
      }
    }

    clearDraft();
    form.reset({
      name: "",
      description: "",
      price: "",
      categoryId: "",
      fitFeatures: "",
      fabricCare: "",
      images: emptyImages,
      section: "men"
    });
    setVariants([]);
    setVSize("");
    setVColor("");
    setVStock("0");
    setOpen(false);
    router.push("/products");
    router.refresh();
  }

  const { isSubmitting } = form.formState;

  /* ---------------------------------- view ---------------------------------- */

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="outline"> + Add product</Button>}
      />

      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add product</DialogTitle>
          <DialogDescription>
            Fill in the details, upload images, and add the sizes and colors you
            stock.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable body so long forms don't overflow the screen */}
        <div className="max-h-[65vh] overflow-y-auto pr-1">
          <form id="product-form" onSubmit={form.handleSubmit(onSubmit)}>
            <FieldGroup>
              <Controller
                name="name"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="name">Name</FieldLabel>
                    <Input
                      {...field}
                      id="name"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                name="description"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="description">Description</FieldLabel>
                    <Textarea
                      {...field}
                      id="description"
                      rows={4}
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <Controller
                  name="price"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="price">Price</FieldLabel>
                      <Input
                        {...field}
                        id="price"
                        type="number"
                        step="0.01"
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                <Controller
                  name="categoryId"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="categoryId">Category</FieldLabel>
                      <Select
                        items={categories.map((c) => ({
                          label: c.name,
                          value: c.id,
                        }))}
                        value={field.value}
                        onValueChange={(value) => field.onChange(value ?? "")}
                      >
                        <SelectTrigger id="categoryId" className="w-full">
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {categories.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>
                                {cat.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                <Controller
                  name="section"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="section">Section</FieldLabel>
                      <Select
                        items={SECTIONS}
                        value={field.value}
                        onValueChange={(value) => field.onChange(value ?? "")}
                      >
                        <SelectTrigger id="section" className="w-full">
                          <SelectValue placeholder="Select a section" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {SECTIONS.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </div>

              <Controller
                name="fitFeatures"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="fitFeatures">
                      Fit &amp; features
                    </FieldLabel>
                    <Textarea
                      {...field}
                      id="fitFeatures"
                      rows={4}
                      placeholder={
                        "One point per line, e.g.\nSlim fit\nCrew neck\nBreathable fabric"
                      }
                      aria-invalid={fieldState.invalid}
                    />
                    <FieldDescription>One point per line.</FieldDescription>
                  </Field>
                )}
              />

              <Controller
                name="fabricCare"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="fabricCare">
                      Fabric &amp; care
                    </FieldLabel>
                    <Textarea
                      {...field}
                      id="fabricCare"
                      rows={4}
                      placeholder={
                        "One point per line, e.g.\n100% cotton\nMachine wash cold\nDo not bleach"
                      }
                      aria-invalid={fieldState.invalid}
                    />
                    <FieldDescription>One point per line.</FieldDescription>
                  </Field>
                )}
              />

              <Controller
                name="images"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Product images</FieldLabel>
                    <ProductImagesUpload
                      value={field.value}
                      onChange={field.onChange}
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <FieldSeparator />

              {/* Draft variants */}
              <FieldSet>
                <FieldLegend variant="label">
                  Variants (size, color, stock)
                </FieldLegend>

                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    items={SIZES}
                    value={vSize}
                    onValueChange={(value) => setVSize(value ?? "")}
                  >
                    <SelectTrigger className="w-[120px]" aria-label="Size">
                      <SelectValue placeholder="Size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {SIZES.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>

                  <Input
                    type="text"
                    placeholder="Color"
                    aria-label="Color"
                    value={vColor}
                    onChange={(e) => setVColor(e.target.value)}
                    className="w-28"
                  />
                  <Input
                    type="number"
                    placeholder="Stock"
                    aria-label="Stock"
                    value={vStock}
                    onChange={(e) => setVStock(e.target.value)}
                    className="w-24"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={addDraftVariant}
                  >
                    Add variant
                  </Button>
                </div>

                {variants.length > 0 && (
                  <ul className="divide-y rounded-lg border">
                    {variants.map((v) => (
                      <li
                        key={v.tempId}
                        className="flex items-center justify-between px-3 py-2 text-sm"
                      >
                        <span>
                          {v.size} / {v.color} — stock: {v.stock}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${v.size} ${v.color}`}
                          onClick={() => removeDraftVariant(v.tempId)}
                        >
                          <TrashIcon size={16} />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </FieldSet>
            </FieldGroup>
          </form>
        </div>

        {serverError && (
          <p className="text-sm text-destructive">{serverError}</p>
        )}
        {/* Outside the <form>, so the submit button points to it with form="" */}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              form.reset({
                name: "",
                description: "",
                price: "",
                categoryId: "",
                fitFeatures: "",
                fabricCare: "",
                images: emptyImages,
                section: "men"
              });
              setVariants([]);
              setServerError("");
              clearDraft();
            }}
          >
            Reset
          </Button>
          <Button type="submit" form="product-form" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
