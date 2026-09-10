// Menghitung daftar varian harga yang tersedia untuk sebuah produk,
// termasuk modal (cost_basis) khusus tiap tingkatan supaya laba dihitung
// dengan benar, dan bagaimana tiap varian memengaruhi jumlah stok dasar.

export function getPriceVariants(product) {
  const variants = [];

  // Produk timbangan (kg) tidak punya harga "eceran" generik — dijual
  // langsung per kg / setengah kg / ons.
  if (product.unit_type !== "kg") {
    variants.push({
      price_type: "retail",
      label: "Eceran",
      unit_price: Number(product.sell_price || 0),
      cost_basis: Number(product.cost_price || 0),
      stock_factor: 1,
    });
  }

  if (product.unit_type === "unit") {
    const w = Array.isArray(product.product_wholesale_pricing)
      ? product.product_wholesale_pricing[0]
      : product.product_wholesale_pricing;
    if (w?.wholesale_qty && w?.wholesale_price) {
      variants.push({
        price_type: "grosir",
        label: `Grosir (${w.wholesale_qty} pcs)`,
        unit_price: Number(w.wholesale_price),
        cost_basis: Number(w.wholesale_cost_price || 0),
        stock_factor: Number(w.wholesale_qty),
      });
    }
    if (w?.half_wholesale_qty && w?.half_wholesale_price) {
      variants.push({
        price_type: "half_grosir",
        label: `Setengah Grosir (${w.half_wholesale_qty} pcs)`,
        unit_price: Number(w.half_wholesale_price),
        cost_basis: Number(w.half_wholesale_cost_price || 0),
        stock_factor: Number(w.half_wholesale_qty),
      });
    }
  }

  if (product.unit_type === "kg") {
    const k = Array.isArray(product.product_kg_pricing)
      ? product.product_kg_pricing[0]
      : product.product_kg_pricing;
    if (k?.price_per_kg) {
      variants.push({
        price_type: "kg",
        label: "Per Kg",
        unit_price: Number(k.price_per_kg),
        cost_basis: Number(k.cost_per_kg || product.cost_price || 0),
        stock_factor: 1,
      });
    }
    if (k?.price_per_half_kg) {
      variants.push({
        price_type: "half_kg",
        label: "Per 1/2 Kg",
        unit_price: Number(k.price_per_half_kg),
        cost_basis: Number(k.cost_per_half_kg || 0),
        stock_factor: 0.5,
      });
    }
    if (k?.price_per_ons) {
      variants.push({
        price_type: "ons",
        label: "Per Ons (100gr)",
        unit_price: Number(k.price_per_ons),
        cost_basis: Number(k.cost_per_ons || 0),
        stock_factor: 0.1,
      });
    }
  }

  const oot = Array.isArray(product.product_out_of_town_pricing)
    ? product.product_out_of_town_pricing[0]
    : product.product_out_of_town_pricing;
  if (oot?.price) {
    variants.push({
      price_type: "out_of_town",
      label: "Antar Luar Kota",
      unit_price: Number(oot.price),
      cost_basis: Number(product.cost_price || 0),
      stock_factor: 1,
    });
  }

  return variants;
}

export function priceTypeLabel(type) {
  return (
    {
      retail: "Eceran",
      grosir: "Grosir",
      half_grosir: "1/2 Grosir",
      kg: "Per Kg",
      half_kg: "1/2 Kg",
      ons: "Per Ons",
      out_of_town: "Antar Luar Kota",
    }[type] || type
  );
}
