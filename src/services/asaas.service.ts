import dotenv from "dotenv";
dotenv.config();

const ASAAS_BASE_URL = process.env.ASAAS_BASE_URL!;
const ASAAS_API_KEY = process.env.ASAAS_API_KEY!;

interface AsaasResponse {
  data?: any[];
  id?: string;
  errors?: { description: string }[];
  paymentLink?: string;
  status?: string;
}

async function asaasRequest(
  method: string,
  path: string,
  body?: object,
): Promise<AsaasResponse> {
  const res = await fetch(`${ASAAS_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      access_token: ASAAS_API_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = (await res.json()) as AsaasResponse;

  if (!res.ok) {
    console.error("[asaas] Error response:", JSON.stringify(data));
    throw new Error("Erro na API do Asaas");
  }

  return data;
}

export async function createOrFindCustomer(user: {
  id: string;
  name: string;
  email: string;
  cpf_cnpj: string;
}) {
  const search = await asaasRequest("GET", `/customers?email=${user.email}`);

  if (search.data && search.data.length > 0) {
    const existing = search.data[0];
    if (!existing.cpfCnpj) {
      await updateCustomer(existing.id, user.cpf_cnpj);
    }
    return existing;
  }

  return await asaasRequest("POST", "/customers", {
    name: user.name,
    email: user.email,
    cpfCnpj: user.cpf_cnpj,
    externalReference: user.id,
  });
}

export async function createSubscription(customerId: string) {
  return await asaasRequest("POST", "/subscriptions", {
    customer: customerId,
    billingType: "UNDEFINED",
    value: 29.0,
    nextDueDate: new Date().toISOString().split("T")[0],
    cycle: "MONTHLY",
    description: "UpStat Pro — Plano mensal",
  });
}

export async function cancelSubscription(subscriptionId: string) {
  return await asaasRequest("DELETE", `/subscriptions/${subscriptionId}`);
}

export async function updateCustomer(customerId: string, cpf_cnpj: string) {
  return await asaasRequest("PUT", `/customers/${customerId}`, {
    cpfCnpj: cpf_cnpj,
  });
}

export async function getSubscriptionPaymentLink(subscriptionId: string) {
  const res = await asaasRequest(
    "GET",
    `/subscriptions/${subscriptionId}/payments`,
  );
  if (res.data && res.data.length > 0) {
    return res.data[0].invoiceUrl || res.data[0].bankSlipUrl || null;
  }
  return null;
}
