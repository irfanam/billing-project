import pytest
from decimal import Decimal
from backend.app import repository as repo


class SimpleResult:
    def __init__(self, data):
        self.data = data
        self.error = None


class FakeSupabase:
    def __init__(self):
        self.products = {}
        self.reservations = {}
        self.movements = []

    def table(self, name):
        return TableProxy(self, name)


class TableProxy:
    def __init__(self, db, name):
        self.db = db
        self.name = name
        self._q = []

    def select(self, *args, **kwargs):
        self._op = 'select'
        return self

    def eq(self, k, v):
        # emulate simple filters
        self._filter = (k, v)
        return self

    def single(self):
        self._single = True
        return self

    def execute(self):
        if getattr(self, '_op', None) == 'select':
            if self.name == 'products':
                pid = self._filter[1]
                prod = self.db.products.get(pid)
                return SimpleResult(prod)
            if self.name == 'stock_reservations':
                pid = self._filter[1]
                # return list of active reservations
                res = [v for v in self.db.reservations.values() if v['product_id'] == pid and v['status'] == 'active']
                return SimpleResult(res)
            return SimpleResult(None)

        if getattr(self, '_op', None) == 'insert':
            rec = self._insert_data
            if self.name == 'stock_reservations':
                rid = 'r' + str(len(self.db.reservations) + 1)
                rec = dict(rec)
                rec['id'] = rid
                rec['status'] = 'active'
                self.db.reservations[rid] = rec
                return SimpleResult([rec])
            if self.name == 'stock_movements':
                self.db.movements.append(rec)
                return SimpleResult([rec])
            return SimpleResult(None)

        if getattr(self, '_op', None) == 'update':
            rec = self._update_data
            if self.name == 'products' and getattr(self, '_filter', (None,))[0] == 'id':
                pid = self._filter[1]
                if pid in self.db.products:
                    self.db.products[pid].update(rec)
                    return SimpleResult([self.db.products[pid]])
            if self.name == 'stock_reservations' and getattr(self, '_filter', (None,))[0] == 'id':
                rid = self._filter[1]
                self.db.reservations[rid].update(rec)
                return SimpleResult([self.db.reservations[rid]])
            return SimpleResult(None)

    def insert(self, rec):
        # store for execute
        self._insert_data = rec
        self._op = 'insert'
        return self

    def update(self, rec):
        # store for execute
        self._update_data = rec
        self._op = 'update'
        return self


@pytest.fixture(autouse=True)
def fake_supabase(monkeypatch):
    fake = FakeSupabase()
    # create product p1 with stock 10
    fake.products['p1'] = {'id': 'p1', 'stock_qty': 10}
    monkeypatch.setattr(repo, '_get_supabase', lambda: fake)
    return fake


def test_reserve_and_consume_success(fake_supabase):
    res = repo.reserve_stock('p1', 3, invoice_id='inv1')
    assert res is not None
    cur = repo.get_current_stock('p1')
    assert cur['on_hand'] == 10
    assert cur['reserved'] == 3
    assert cur['available'] == 7

    # consume reservation
    ok = repo.consume_reservation(res['id'])
    assert ok
    cur = repo.get_current_stock('p1')
    # after consumption, stock_qty should have decreased by 3
    assert cur['on_hand'] == 7
    assert cur['reserved'] == 0


def test_reserve_insufficient_stock(fake_supabase):
    res = repo.reserve_stock('p1', 11)
    assert res is None


def test_release_reservation(fake_supabase):
    res = repo.reserve_stock('p1', 2)
    assert res is not None
    ok = repo.release_reservation(res['id'])
    assert ok
    cur = repo.get_current_stock('p1')
    assert cur['reserved'] == 0
