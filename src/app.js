import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { and, count, eq, ilike, asc, like } from "drizzle-orm";
import { Hono } from "hono";
import { html } from "hono/html";
import { db } from "./db.js";
import { product } from "./schema.js";
import { generateHTML } from "./template.js";
import esMain from "es-main";

export const start_server = () => {
    const PORT = process.env.PORT || 3000;
    const app = new Hono();

    function searchPagination(totalPages, currentPage, query) {
        const links = [];
        for (let i = 1; i <= totalPages; i++) {
            if (i === currentPage) {
                links.push(html`<span class="active">${i}</span>`);     //format string function - helpful to interpolate variables from js code into long strings
            } else {                                                  //html takes anything that counts as an escape character from the data world into the code world, interpolates into a string
                links.push(html`
          <a href="/?query=${encodeURIComponent(query)}&page=${i}">${i}</a>
        `);
            }
        }
        return links;
    }

    app.get("/public/*", serveStatic({ root: "./" }));

    app.get("/", async (c) => {

        //const allProducts = db.select().from(product).limit(10).all();

        const query = c.req.query("query") || "";
        const page = parseInt(c.req.query("page") || "1", 10);
        const limit = 10;
        const offset = (page - 1) * limit;

        // Fetch total number of products matching the search query
        const totalProductsResult = await db.select({ count: count() }).from(product).where(like(product.name, `%${query}%`)); // .first();
        console.log("Total Products Result: ", totalProductsResult);
        const totalProducts = totalProductsResult[0]?.count || 0;
        //const totalProducts = totalProductsResult.count;
        console.log("Total Products: ", totalProducts);//add ||0
        const totalPages = Math.ceil(totalProducts / limit);
        console.log("Total Pages: ", totalPages);

        // Fetch products for the current page
        const products = await db
            .select()
            .from(product)
            .where(like(product.name, `%${query}%`))
            .limit(limit)
            .offset(offset)
            .all();

        // Generate pagination links
        const paginationLinks = searchPagination(totalPages, page, query);


        // Generate pagination links
        // const totalProducts = await db.select(count()).from(product).where(ilike(product.name, `%${query}%`)).first();

        // const totalPages = Math.ceil(totalProducts.count / limit);
        // const paginationLinks = searchPagination(totalPages, page, query);




        return c.html(
            generateHTML(
                {
                    title: "Store",
                    products: products,
                    paginationLinks: paginationLinks,
                    status: "",
                    query: "",
                }
            )
        );
    });

    // Delete a product
    app.post("/delete", async (c) => {
        //const body = await c.req.parseBody();
        try {
            // Parse the request body (for form-encoded data)
            const body = await c.req.parseBody();

            // Extract the product ID from the form submission
            const productID = body.productID;

            // Ensure the ID is present
            if (!productID) {
                return c.json({ status: "error", message: "Product ID is required" }, 400);
            }

            // Delete the product from the database using the ID
            const deleteResult = await db
                .delete(product)
                .where(eq(product.id, productID))
                .run();

            return c.redirect("/");

            // Check if the delete was successful
            // if (deleteResult.rowCount > 0) {
            //   return c.redirect("/"); // Redirect to the home page after deletion
            //} else {
            //    return c.json({ status: "error", message: "Product not found" }, 404);
            //}
        } catch (error) {
            console.error("Error deleting product:", error);
            return c.json({ status: "error", message: "Internal Server Error" }, 500);
        }
        // Parse the request body to get the product ID
        //const id = c.req.parseBody();

        // Ensure the ID is present
        //if (id) { return c.json({ status: "error", message: "Product ID is required" }, 400); }


        // Delete the product from the database using the ID
        //const deleteResult = await db.delete(product).where(eq(product.id, id)).run();



    });

    // Create a new product
    app.post("/add", async (c) => {
        const body = await c.req.parseBody();
        const data = { ...body };
        console.log("Request Body: ", data);

        const { name, image_url } = data;

        // Ensure required fields are present
        if (!name || !image_url) {
            return c.json({ status: "error", message: "Product name and price are required" }, 400);
        }

        // Insert the product into the database
        const insertResult = await db
            .insert(product)
            .values({
                name,
                image_url,
            })
            .run();

        return c.redirect("/");

    });

    serve({ fetch: app.fetch, port: PORT });
    console.log(`Server is running at http://localhost:${PORT}`);
    return app;
};

if (esMain(import.meta)) {
    start_server();
}
