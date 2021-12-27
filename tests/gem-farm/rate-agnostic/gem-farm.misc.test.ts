import chai, { assert, expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {
  defaultFarmConfig,
  defaultFixedConfig,
  GemFarmTester,
} from '../gem-farm.tester';
import { BN } from '@project-serum/anchor';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { pause } from '../../utils/types';
import { FarmConfig, RewardType } from '../gem-farm.client';
import { WhitelistType } from '../../gem-bank/gem-bank.client';

chai.use(chaiAsPromised);

const updatedFarmConfig = <FarmConfig>{
  minStakingPeriodSec: new BN(0),
  cooldownPeriodSec: new BN(0),
  unstakingFeeLamp: new BN(LAMPORTS_PER_SOL / 2),
};

const creator = new PublicKey('75ErM1QcGjHiPMX7oLsf9meQdGSUs4ZrwS2X8tBpsZhA');

describe.only('misc', () => {
  let gf = new GemFarmTester();

  before('preps accs', async () => {
    await gf.prepAccounts(new BN(45000));
  });

  it('inits the farm', async () => {
    await gf.callInitFarm(defaultFarmConfig, RewardType.Fixed);

    const farmAcc = (await gf.fetchFarm()) as any;
    assert.equal(farmAcc.bank.toBase58(), gf.bank.publicKey.toBase58());
    assert.equal(
      farmAcc[gf.reward].rewardMint.toBase58(),
      gf.rewardMint.publicKey.toBase58()
    );
  });

  it('updates the farm', async () => {
    await gf.callUpdateFarm(updatedFarmConfig);

    const farmAcc = await gf.fetchFarm();
    assert.equal(
      farmAcc.config.unstakingFeeLamp.toNumber(),
      LAMPORTS_PER_SOL / 2
    );
  });

  it('fails to double init an existing farm', async () => {
    await expect(
      gf.callInitFarm(defaultFarmConfig, RewardType.Fixed)
    ).to.be.rejectedWith('0x0'); //account in use
  });

  // --------------------------------------- farmer

  it('inits farmer', async () => {
    //farmer 1
    let { farmer } = await gf.callInitFarmer(gf.farmer1Identity);

    const farmerAcc = await gf.fetchFarmerAcc(farmer);
    assert.equal(farmerAcc.farm.toBase58(), gf.farm.publicKey.toBase58());

    //farmer 2
    await gf.callInitFarmer(gf.farmer2Identity);
  });

  it('refreshes farmer (signed)', async () => {
    //as long as it succeeds - test's ok
    await gf.callRefreshFarmer(gf.farmer1Identity, false);
  });

  it('FAILS to refresh farmer (signed)', async () => {
    //w/o reenrolling we're calling the normal one
    await gf.callRefreshFarmer(gf.farmer1Identity.publicKey);
    //now we're calling the signed one, and this should fail
    await expect(
      gf.callRefreshFarmer(gf.farmer1Identity.publicKey, false)
    ).to.be.rejectedWith('Signature verification failed');
  });

  // --------------------------------------- whitelisting

  it('whitelists a creator', async () => {
    let { whitelistProof } = await gf.callAddToBankWhitelist(
      creator,
      WhitelistType.Creator
    );

    const proofAcc = await gf.fetchWhitelistProofAcc(whitelistProof);
    assert.equal(proofAcc.whitelistedAddress.toBase58(), creator.toBase58());
    assert.equal(proofAcc.whitelistType, WhitelistType.Creator);
  });

  it('removes a whitelisted creator', async () => {
    let { whitelistProof } = await gf.callRemoveFromBankWhitelist(creator);

    await expect(gf.fetchWhitelistProofAcc(whitelistProof)).to.be.rejectedWith(
      'Account does not exist'
    );
  });

  // --------------------------------------- authorization

  it('authorizes funder', async () => {
    const { authorizationProof } = await gf.callAuthorize();

    const authorizationProofAcc = await gf.fetchAuthorizationProofAcc(
      authorizationProof
    );
    assert.equal(
      authorizationProofAcc.authorizedFunder.toBase58,
      gf.funder.publicKey.toBase58
    );

    // testing idempotency - should NOT throw an error
    await gf.callAuthorize();
  });

  it('deauthorizes funder', async () => {
    const { authorizationProof } = await gf.callDeauthorize();

    await expect(
      gf.fetchAuthorizationProofAcc(authorizationProof)
    ).to.be.rejectedWith('Account does not exist');

    //funding should not be possible now
    await expect(
      gf.callFundReward(undefined, defaultFixedConfig)
    ).to.be.rejectedWith(
      'The given account is not owned by the executing program'
    );

    //second should fail (not idempotent)
    await expect(gf.callDeauthorize()).to.be.rejectedWith(
      'The given account is not owned by the executing program'
    );
  });

  // --------------------------------------- flash deposit

  it('flash deposits a gem', async () => {
    const initialDeposit = new BN(1); //drop 1 existing gem, need to lock the vault
    await gf.callDeposit(initialDeposit, gf.farmer1Identity);

    //stake to lock the vault
    const { farmer, vault } = await gf.callStake(gf.farmer1Identity);

    let vaultAcc = await gf.fetchVaultAcc(vault);
    assert(vaultAcc.gemCount.eq(initialDeposit));
    assert.isTrue(vaultAcc.locked);

    let farmAcc = await gf.fetchFarm();
    assert(farmAcc.stakedFarmerCount.eq(new BN(1)));
    assert(farmAcc.gemsStaked.eq(initialDeposit));

    let farmerAcc = await gf.fetchFarmerAcc(farmer);
    assert(farmerAcc.gemsStaked.eq(initialDeposit));
    const oldEndTs = farmerAcc.minStakingEndsTs;

    //wait for 1 sec so that flash deposit staking time is recorded as different
    await pause(1000);

    //flash deposit after vault locked
    const flashDeposit = new BN(1);

    await gf.callFlashDeposit(flashDeposit, gf.farmer1Identity);
    // await printStructs('FLASH DEPOSITS');

    vaultAcc = await gf.fetchVaultAcc(vault);
    assert(vaultAcc.gemCount.eq(initialDeposit.add(flashDeposit)));
    assert.isTrue(vaultAcc.locked);

    farmAcc = await gf.fetchFarm();
    assert(farmAcc.stakedFarmerCount.eq(new BN(1)));
    assert(farmAcc.gemsStaked.eq(initialDeposit.add(flashDeposit)));

    farmerAcc = await gf.fetchFarmerAcc(farmer);
    assert(farmerAcc.gemsStaked.eq(initialDeposit.add(flashDeposit)));
    //flash deposits resets staking time, which means it should be higher
    assert(farmerAcc.minStakingEndsTs.gt(oldEndTs));
  });

  it('flash deposits a gem (whitelisted)', async () => {
    //prep - use the 2nd farmer this itme
    const initialDeposit = new BN(1); //drop 1 existing gem, need to lock the vault
    await gf.callDeposit(initialDeposit, gf.farmer2Identity);
    const { vault } = await gf.callStake(gf.farmer2Identity);

    //whitelist mint
    const { whitelistProof } = await gf.callAddToBankWhitelist(
      gf.gem2.tokenMint,
      WhitelistType.Mint
    );

    //flash deposit after vault locked
    const flashDeposit = new BN(1);
    await gf.callFlashDeposit(flashDeposit, gf.farmer2Identity, whitelistProof);

    //this is enough to verify it worked
    const vaultAcc = await gf.fetchVaultAcc(vault);
    assert(vaultAcc.gemCount.eq(initialDeposit.add(flashDeposit)));
    assert.isTrue(vaultAcc.locked);
  });

  // --------------------------------------- treasury payout

  it('pays out from treasury', async () => {
    // unstake to accrue payout fees that will go into treasury
    await gf.callUnstake(gf.farmer1Identity);

    const destination = await gf.createWallet(0);

    await gf.callPayout(destination.publicKey, new BN(LAMPORTS_PER_SOL / 2));

    const balance = await gf.getBalance(destination.publicKey);
    assert.equal(balance, LAMPORTS_PER_SOL / 2);
  });
});