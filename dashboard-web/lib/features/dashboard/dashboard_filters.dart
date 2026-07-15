/// Shared filter state for the whole dashboard page. A single source of truth that every
/// chart/KPI provider watches — changing either field re-fetches everything that depends
/// on it, but each chart still has its own independent loading/error state (see
/// dashboard_providers.dart), so one slow/failed endpoint never blocks the rest of the page.
class DashboardFilters {
  const DashboardFilters({this.districtId, this.days = 30});

  final String? districtId;
  final int days;

  DashboardFilters copyWithDistrict(String? districtId) => DashboardFilters(districtId: districtId, days: days);

  DashboardFilters copyWithDays(int days) => DashboardFilters(districtId: districtId, days: days);
}

const List<int> kDashboardDayOptions = [7, 30, 90];
