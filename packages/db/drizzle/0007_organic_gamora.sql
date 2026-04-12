CREATE TYPE "public"."scope_allocation_mode" AS ENUM('package', 'not_relevant', 'multiple');--> statement-breakpoint
ALTER TABLE "interface_points" ADD COLUMN "scope_spec_package_id" uuid;--> statement-breakpoint
ALTER TABLE "interface_points" ADD COLUMN "scope_spec_mode" "scope_allocation_mode" DEFAULT 'package' NOT NULL;--> statement-breakpoint
ALTER TABLE "interface_points" ADD COLUMN "scope_des_package_id" uuid;--> statement-breakpoint
ALTER TABLE "interface_points" ADD COLUMN "scope_des_mode" "scope_allocation_mode" DEFAULT 'package' NOT NULL;--> statement-breakpoint
ALTER TABLE "interface_points" ADD COLUMN "scope_sup_package_id" uuid;--> statement-breakpoint
ALTER TABLE "interface_points" ADD COLUMN "scope_sup_mode" "scope_allocation_mode" DEFAULT 'package' NOT NULL;--> statement-breakpoint
ALTER TABLE "interface_points" ADD COLUMN "scope_on_a_package_id" uuid;--> statement-breakpoint
ALTER TABLE "interface_points" ADD COLUMN "scope_on_a_mode" "scope_allocation_mode" DEFAULT 'package' NOT NULL;--> statement-breakpoint
ALTER TABLE "interface_points" ADD COLUMN "scope_on_t_package_id" uuid;--> statement-breakpoint
ALTER TABLE "interface_points" ADD COLUMN "scope_on_t_mode" "scope_allocation_mode" DEFAULT 'package' NOT NULL;--> statement-breakpoint
ALTER TABLE "interface_points" ADD COLUMN "scope_on_c_package_id" uuid;--> statement-breakpoint
ALTER TABLE "interface_points" ADD COLUMN "scope_on_c_mode" "scope_allocation_mode" DEFAULT 'package' NOT NULL;--> statement-breakpoint
ALTER TABLE "interface_points" ADD COLUMN "scope_off_t_package_id" uuid;--> statement-breakpoint
ALTER TABLE "interface_points" ADD COLUMN "scope_off_t_mode" "scope_allocation_mode" DEFAULT 'package' NOT NULL;--> statement-breakpoint
ALTER TABLE "interface_points" ADD COLUMN "scope_off_i_package_id" uuid;--> statement-breakpoint
ALTER TABLE "interface_points" ADD COLUMN "scope_off_i_mode" "scope_allocation_mode" DEFAULT 'package' NOT NULL;--> statement-breakpoint
ALTER TABLE "interface_points" ADD COLUMN "scope_off_c_package_id" uuid;--> statement-breakpoint
ALTER TABLE "interface_points" ADD COLUMN "scope_off_c_mode" "scope_allocation_mode" DEFAULT 'package' NOT NULL;--> statement-breakpoint
ALTER TABLE "interface_points" ADD CONSTRAINT "interface_points_scope_spec_package_id_work_packages_id_fk" FOREIGN KEY ("scope_spec_package_id") REFERENCES "public"."work_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_points" ADD CONSTRAINT "interface_points_scope_des_package_id_work_packages_id_fk" FOREIGN KEY ("scope_des_package_id") REFERENCES "public"."work_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_points" ADD CONSTRAINT "interface_points_scope_sup_package_id_work_packages_id_fk" FOREIGN KEY ("scope_sup_package_id") REFERENCES "public"."work_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_points" ADD CONSTRAINT "interface_points_scope_on_a_package_id_work_packages_id_fk" FOREIGN KEY ("scope_on_a_package_id") REFERENCES "public"."work_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_points" ADD CONSTRAINT "interface_points_scope_on_t_package_id_work_packages_id_fk" FOREIGN KEY ("scope_on_t_package_id") REFERENCES "public"."work_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_points" ADD CONSTRAINT "interface_points_scope_on_c_package_id_work_packages_id_fk" FOREIGN KEY ("scope_on_c_package_id") REFERENCES "public"."work_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_points" ADD CONSTRAINT "interface_points_scope_off_t_package_id_work_packages_id_fk" FOREIGN KEY ("scope_off_t_package_id") REFERENCES "public"."work_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_points" ADD CONSTRAINT "interface_points_scope_off_i_package_id_work_packages_id_fk" FOREIGN KEY ("scope_off_i_package_id") REFERENCES "public"."work_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_points" ADD CONSTRAINT "interface_points_scope_off_c_package_id_work_packages_id_fk" FOREIGN KEY ("scope_off_c_package_id") REFERENCES "public"."work_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "interface_points_scope_spec_pkg_idx" ON "interface_points" USING btree ("scope_spec_package_id");--> statement-breakpoint
CREATE INDEX "interface_points_scope_des_pkg_idx" ON "interface_points" USING btree ("scope_des_package_id");--> statement-breakpoint
CREATE INDEX "interface_points_scope_sup_pkg_idx" ON "interface_points" USING btree ("scope_sup_package_id");--> statement-breakpoint
CREATE INDEX "interface_points_scope_on_a_pkg_idx" ON "interface_points" USING btree ("scope_on_a_package_id");--> statement-breakpoint
CREATE INDEX "interface_points_scope_on_t_pkg_idx" ON "interface_points" USING btree ("scope_on_t_package_id");--> statement-breakpoint
CREATE INDEX "interface_points_scope_on_c_pkg_idx" ON "interface_points" USING btree ("scope_on_c_package_id");--> statement-breakpoint
CREATE INDEX "interface_points_scope_off_t_pkg_idx" ON "interface_points" USING btree ("scope_off_t_package_id");--> statement-breakpoint
CREATE INDEX "interface_points_scope_off_i_pkg_idx" ON "interface_points" USING btree ("scope_off_i_package_id");--> statement-breakpoint
CREATE INDEX "interface_points_scope_off_c_pkg_idx" ON "interface_points" USING btree ("scope_off_c_package_id");
